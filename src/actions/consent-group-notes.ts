'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { game, gameMember } from '@/db/schema/games';
import { consentTopic } from '@/db/schema/consent-topics';
import { gameConsentGroupNote, gameConsentTopicGroupNote } from '@/db/schema/consent-group-notes';
import { ensureAccess, getEffectiveUserContext } from './auth-helpers';
import { ActionError, asResult } from './action-helpers';
import { canAccessGameConsent, canAccessGuildConsent } from '@/lib/consent/feature-gate';
import { EMPTY_GROUP_NOTE } from '@/lib/consent/group-notes';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const staleMessage =
  'This group note changed. Your draft has been kept. Reload the latest note before saving.';

async function caller(guildId: string) {
  const access = await ensureAccess(guildId);
  const context = await getEffectiveUserContext(guildId);
  if (
    !context ||
    context.isImpersonating ||
    access.isImpersonating ||
    !canAccessGuildConsent(access.guildData?.consentEnabled === true)
  ) {
    throw new ActionError('Group note editing is not available.');
  }
  return access.discordAccount.userId;
}

async function authorize(
  tx: Tx,
  guildId: string,
  gameId: string,
  topicId: string | null,
  userId: string,
) {
  if (
    typeof gameId !== 'string' ||
    !gameId ||
    (topicId !== null && (typeof topicId !== 'string' || !topicId))
  ) {
    throw new ActionError('Choose a valid game and topic.');
  }
  // Serialize with mode changes, member removal and assignment revocation.
  const [selected] = await tx
    .select({ mode: game.consentMode })
    .from(game)
    .where(and(eq(game.guildId, guildId), eq(game.id, gameId)))
    .for('share');
  if (!selected || !canAccessGameConsent(true, selected.mode))
    throw new ActionError('Group note editing is not available.');
  const [assignment] = await tx
    .select({ id: gameMember.id })
    .from(gameMember)
    .where(
      and(
        eq(gameMember.gameId, gameId),
        eq(gameMember.discordUserId, userId),
        eq(gameMember.isConsentCoordinator, true),
      ),
    )
    .for('share');
  if (!assignment)
    throw new ActionError('Only assigned consent coordinators can edit group notes.');
  if (topicId !== null) {
    const [topic] = await tx
      .select({ id: consentTopic.id })
      .from(consentTopic)
      .where(
        and(
          eq(consentTopic.guildId, guildId),
          eq(consentTopic.id, topicId),
          isNull(consentTopic.ownerDiscordUserId),
        ),
      )
      .for('share');
    if (!topic) throw new ActionError('Official topic not found in this guild.');
  }
}

export const getGameConsentGroupNote = asResult(
  'getGameConsentGroupNote',
  async (guildId: string, gameId: string, topicId: string | null) => {
    try {
      const userId = await caller(guildId);
      return await db.transaction(async (tx) => {
        await authorize(tx, guildId, gameId, topicId, userId);
        const table = topicId === null ? gameConsentGroupNote : gameConsentTopicGroupNote;
        const [note] = await tx
          .select({ note: table.note, revision: table.revision })
          .from(table)
          .where(
            and(
              eq(table.guildId, guildId),
              eq(table.gameId, gameId),
              topicId === null ? undefined : eq(gameConsentTopicGroupNote.topicId, topicId),
            ),
          );
        return note ?? EMPTY_GROUP_NOTE;
      });
    } catch (error) {
      if (error instanceof ActionError) throw error;
      throw new ActionError('Could not load the group note.');
    }
  },
  'Could not load the group note.',
);

export const saveGameConsentGroupNote = asResult(
  'saveGameConsentGroupNote',
  async (
    guildId: string,
    gameId: string,
    topicId: string | null,
    note: string,
    expectedRevision: number,
  ) => {
    try {
      const userId = await caller(guildId);
      if (
        typeof note !== 'string' ||
        note.length > 10000 ||
        !Number.isSafeInteger(expectedRevision) ||
        expectedRevision < 0 ||
        expectedRevision >= 2147483647
      ) {
        throw new ActionError('Use a group note of at most 10000 characters and a valid revision.');
      }
      const text = note.trim() ? note : '';
      const result = await db.transaction(async (tx) => {
        await authorize(tx, guildId, gameId, topicId, userId);
        const table = topicId === null ? gameConsentGroupNote : gameConsentTopicGroupNote;
        if (expectedRevision === 0) {
          const rows =
            topicId === null
              ? await tx
                  .insert(gameConsentGroupNote)
                  .values({ guildId, gameId, note: text })
                  .onConflictDoNothing()
                  .returning({ note: table.note, revision: table.revision })
              : await tx
                  .insert(gameConsentTopicGroupNote)
                  .values({ guildId, gameId, topicId, note: text })
                  .onConflictDoNothing()
                  .returning({ note: table.note, revision: table.revision });
          if (!rows.length) throw new ActionError(staleMessage);
          return rows[0];
        }
        const rows = await tx
          .update(table)
          .set({ note: text, revision: sql`${table.revision} + 1`, updatedAt: new Date() })
          .where(
            and(
              eq(table.guildId, guildId),
              eq(table.gameId, gameId),
              topicId === null ? undefined : eq(gameConsentTopicGroupNote.topicId, topicId),
              eq(table.revision, expectedRevision),
            ),
          )
          .returning({ note: table.note, revision: table.revision });
        if (!rows.length) throw new ActionError(staleMessage);
        return rows[0];
      });
      revalidatePath(`/g/${guildId}/games/${gameId}/consent`);
      return result;
    } catch (error) {
      // INSERT/UPDATE errors can embed note text in query parameters. Never log them.
      if (error instanceof ActionError) throw error;
      throw new ActionError('Could not save the group note.');
    }
  },
  'Could not save the group note.',
);
