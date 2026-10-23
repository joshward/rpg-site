'use server';

import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { consentTopic } from '@/db/schema/consent-topics';
import {
  consentChecklist,
  consentResponse,
  type ConsentAnswer,
} from '@/db/schema/consent-responses';
import { ensureAccess, getEffectiveUserContext } from '@/actions/auth-helpers';
import { ActionError, asResult } from '@/actions/action-helpers';
import { canAccessGuildConsent, isConsentFeatureEnabled } from '@/lib/consent/feature-gate';
import { missingConsentTopicIds } from '@/lib/consent/completeness';
import { getConsentGuidance } from '@/lib/consent/guidance';

export type ConsentResponseInput = {
  expectedTopicRevision: number;
  answer: ConsentAnswer | null;
  headsUp: boolean;
  note: string | null;
};

async function ensureMyChecklistAccess(guildId: string) {
  if (!isConsentFeatureEnabled()) throw new ActionError('Consent checklists are not available.');
  const access = await ensureAccess(guildId);
  // ensureAccess can fall back to the real admin in another guild. Validate the
  // active context independently before reading or changing any checklist data.
  const context = await getEffectiveUserContext(guildId);
  if (!context || context.isImpersonating || access.isImpersonating) {
    throw new ActionError('Private consent checklists are not available while impersonating.');
  }
  if (!canAccessGuildConsent(access.guildData?.consentEnabled === true)) {
    throw new ActionError('Consent checklists are not enabled for this guild.');
  }
  return {
    discordUserId: access.discordAccount.userId,
    guidance: access.guildData?.consentGuidance ?? null,
  };
}

function normalizeNote(value: unknown): string | null {
  if (value !== null && (typeof value !== 'string' || value.length > 10000)) {
    throw new ActionError('Notes must be at most 10000 characters.');
  }
  return typeof value === 'string' && value.trim() ? value : null;
}

function validateResponse(input: ConsentResponseInput): ConsentResponseInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ActionError('Invalid checklist response.');
  }
  const { expectedTopicRevision, answer, headsUp } = input;
  if (
    !Number.isSafeInteger(expectedTopicRevision) ||
    expectedTopicRevision < 0 ||
    (answer !== null && answer !== 'enthusiastic' && answer !== 'veil' && answer !== 'line') ||
    typeof headsUp !== 'boolean' ||
    (headsUp && (answer === null || answer === 'line'))
  ) {
    throw new ActionError('Invalid checklist response.');
  }
  return { expectedTopicRevision, answer, headsUp, note: normalizeNote(input.note) };
}

export const getMyConsentChecklist = asResult(
  'getMyConsentChecklist',
  async (guildId: string) => {
    const { discordUserId, guidance } = await ensureMyChecklistAccess(guildId);
    const topics = await db
      .select({
        id: consentTopic.id,
        parentTopicId: consentTopic.parentTopicId,
        name: consentTopic.name,
        revision: consentTopic.revision,
      })
      .from(consentTopic)
      .where(and(eq(consentTopic.guildId, guildId), isNull(consentTopic.ownerDiscordUserId)))
      .orderBy(asc(consentTopic.sortOrder), asc(consentTopic.createdAt), asc(consentTopic.name));

    const responses = topics.length
      ? await db
          .select({
            topicId: consentResponse.topicId,
            answer: consentResponse.answer,
            headsUp: consentResponse.headsUp,
            note: consentResponse.note,
          })
          .from(consentResponse)
          .where(
            and(
              eq(consentResponse.guildId, guildId),
              eq(consentResponse.discordUserId, discordUserId),
              inArray(
                consentResponse.topicId,
                topics.map((topic) => topic.id),
              ),
            ),
          )
      : [];
    const overall = await db
      .select({ overallNote: consentChecklist.overallNote })
      .from(consentChecklist)
      .where(
        and(
          eq(consentChecklist.guildId, guildId),
          eq(consentChecklist.discordUserId, discordUserId),
        ),
      );
    const missingTopicIds = missingConsentTopicIds(topics, responses);
    // Never return DB rows, other users' IDs, or private data belonging to anyone else.
    return {
      topics,
      responses,
      guidance: getConsentGuidance(guidance),
      overallNote: overall.length ? overall[0].overallNote : null,
      complete: missingTopicIds.length === 0,
      missingTopicIds,
    };
  },
  'Could not load your consent checklist.',
);

export const saveMyConsentResponse = asResult(
  'saveMyConsentResponse',
  async (guildId: string, topicId: string, input: ConsentResponseInput) => {
    const { discordUserId } = await ensureMyChecklistAccess(guildId);
    if (typeof topicId !== 'string' || !topicId) throw new ActionError('Choose a valid topic.');
    const { expectedTopicRevision, answer, headsUp, note } = validateResponse(input);
    try {
      await db.transaction(async (tx) => {
        // Serialize with an admin's rename/clear, then reject saves based on
        // older wording (including a clear that kept the same name).
        const [topic] = await tx
          .select({ revision: consentTopic.revision })
          .from(consentTopic)
          .where(
            and(
              eq(consentTopic.guildId, guildId),
              eq(consentTopic.id, topicId),
              isNull(consentTopic.ownerDiscordUserId),
            ),
          )
          .for('share');
        if (!topic) throw new ActionError('Topic not found in this guild.');
        if (topic.revision !== expectedTopicRevision) {
          throw new ActionError('This topic changed. Reload your checklist before saving.');
        }

        if (answer === null && note === null) {
          await tx
            .delete(consentResponse)
            .where(
              and(
                eq(consentResponse.guildId, guildId),
                eq(consentResponse.discordUserId, discordUserId),
                eq(consentResponse.topicId, topicId),
              ),
            );
        } else {
          await tx
            .insert(consentResponse)
            .values({ guildId, discordUserId, topicId, answer, headsUp, note })
            .onConflictDoUpdate({
              target: [
                consentResponse.guildId,
                consentResponse.discordUserId,
                consentResponse.topicId,
              ],
              set: { answer, headsUp, note, updatedAt: new Date() },
            });
        }
      });
    } catch (error) {
      // Database errors can contain query parameters, including private notes.
      if (error instanceof ActionError) throw error;
      throw new ActionError('Could not save your consent response.');
    }
  },
  'Could not save your consent response.',
);

export const saveMyConsentOverallNote = asResult(
  'saveMyConsentOverallNote',
  async (guildId: string, value: string | null) => {
    const { discordUserId } = await ensureMyChecklistAccess(guildId);
    const overallNote = normalizeNote(value);
    try {
      if (overallNote === null) {
        await db
          .delete(consentChecklist)
          .where(
            and(
              eq(consentChecklist.guildId, guildId),
              eq(consentChecklist.discordUserId, discordUserId),
            ),
          );
      } else {
        await db
          .insert(consentChecklist)
          .values({ guildId, discordUserId, overallNote })
          .onConflictDoUpdate({
            target: [consentChecklist.guildId, consentChecklist.discordUserId],
            set: { overallNote, updatedAt: new Date() },
          });
      }
    } catch {
      // Do not log an exception that might contain the private note as a query parameter.
      throw new ActionError('Could not save your private note.');
    }
  },
  'Could not save your private note.',
);

/** Save only changed topic rows and, optionally, the overall note in one transaction.
 * Omitted topics are never cleared. A stale revision aborts the entire save. */
export const saveMyConsentChecklist = asResult(
  'saveMyConsentChecklist',
  async (
    guildId: string,
    changes: (ConsentResponseInput & { topicId: string })[],
    overallNote?: string | null,
  ) => {
    const { discordUserId } = await ensureMyChecklistAccess(guildId);
    if (!Array.isArray(changes)) {
      throw new ActionError('Invalid checklist changes.');
    }
    const normalized = changes.map((change) => {
      if (!change || typeof change.topicId !== 'string' || !change.topicId) {
        throw new ActionError('Choose a valid topic.');
      }
      return { topicId: change.topicId, ...validateResponse(change) };
    });
    const topicIds = normalized.map((change) => change.topicId);
    if (new Set(topicIds).size !== topicIds.length) {
      throw new ActionError('A topic can only be saved once at a time.');
    }
    const validatedOverallNote = overallNote === undefined ? undefined : normalizeNote(overallNote);

    try {
      await db.transaction(async (tx) => {
        if (topicIds.length) {
          if (topicIds.length > 200) {
            // Large guilds may have more than 200 official topics. Reject oversized
            // batches only when they exceed this guild's actual topic catalog.
            const [{ total }] = await tx
              .select({ total: count() })
              .from(consentTopic)
              .where(
                and(eq(consentTopic.guildId, guildId), isNull(consentTopic.ownerDiscordUserId)),
              );
            if (topicIds.length > total) throw new ActionError('Invalid checklist changes.');
          }
          const lockedTopics = await tx
            .select({ id: consentTopic.id, revision: consentTopic.revision })
            .from(consentTopic)
            .where(
              and(
                eq(consentTopic.guildId, guildId),
                isNull(consentTopic.ownerDiscordUserId),
                inArray(consentTopic.id, topicIds),
              ),
            )
            .orderBy(asc(consentTopic.id))
            .for('share');
          const revisions = new Map(lockedTopics.map((topic) => [topic.id, topic.revision]));
          if (
            normalized.some(
              (change) => revisions.get(change.topicId) !== change.expectedTopicRevision,
            )
          ) {
            throw new ActionError('A topic changed. Reload your checklist before saving.');
          }
          const removedIds = normalized
            .filter((change) => change.answer === null && change.note === null)
            .map((change) => change.topicId);
          if (removedIds.length) {
            await tx
              .delete(consentResponse)
              .where(
                and(
                  eq(consentResponse.guildId, guildId),
                  eq(consentResponse.discordUserId, discordUserId),
                  inArray(consentResponse.topicId, removedIds),
                ),
              );
          }
          const upserts = normalized
            .filter((change) => change.answer !== null || change.note !== null)
            .map(({ topicId, answer, headsUp, note }) => ({
              guildId,
              discordUserId,
              topicId,
              answer,
              headsUp,
              note,
            }));
          if (upserts.length) {
            await tx
              .insert(consentResponse)
              .values(upserts)
              .onConflictDoUpdate({
                target: [
                  consentResponse.guildId,
                  consentResponse.discordUserId,
                  consentResponse.topicId,
                ],
                set: {
                  answer: sql`excluded.answer`,
                  headsUp: sql`excluded.heads_up`,
                  note: sql`excluded.note`,
                  updatedAt: new Date(),
                },
              });
          }
        }
        if (validatedOverallNote !== undefined) {
          if (validatedOverallNote === null) {
            await tx
              .delete(consentChecklist)
              .where(
                and(
                  eq(consentChecklist.guildId, guildId),
                  eq(consentChecklist.discordUserId, discordUserId),
                ),
              );
          } else {
            await tx
              .insert(consentChecklist)
              .values({ guildId, discordUserId, overallNote: validatedOverallNote })
              .onConflictDoUpdate({
                target: [consentChecklist.guildId, consentChecklist.discordUserId],
                set: { overallNote: validatedOverallNote, updatedAt: new Date() },
              });
          }
        }
      });
    } catch (error) {
      // Drizzle errors may include private notes in their query parameters.
      if (error instanceof ActionError) throw error;
      throw new ActionError('Could not save your consent checklist.');
    }
  },
  'Could not save your consent checklist.',
);
