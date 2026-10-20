'use server';

import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/db';
import { game, gameMember } from '@/db/schema/games';
import { consentTopic } from '@/db/schema/consent-topics';
import { consentResponse } from '@/db/schema/consent-responses';
import { gameConsentGroupNote, gameConsentTopicGroupNote } from '@/db/schema/consent-group-notes';
import { EMPTY_GROUP_NOTE } from '@/lib/consent/group-notes';
import { ensureAccess, getEffectiveUserContext } from './auth-helpers';
import { ActionError, asResult } from './action-helpers';
import { canAccessGameConsent, canAccessGuildConsent } from '@/lib/consent/feature-gate';
import { aggregateConsentTopics } from '@/lib/consent/aggregate';

export const getGameConsentAggregate = asResult(
  'getGameConsentAggregate',
  async (guildId: string, gameId: string) => {
    const access = await ensureAccess(guildId);
    const context = await getEffectiveUserContext(guildId);
    if (
      !context ||
      context.isImpersonating ||
      access.isImpersonating ||
      !canAccessGuildConsent(access.guildData?.consentEnabled === true)
    ) {
      throw new ActionError('Game content boundaries are not available.');
    }
    if (typeof gameId !== 'string' || !gameId) throw new ActionError('Game not found.');
    const [selected] = await db
      .select({ id: game.id, name: game.name, mode: game.consentMode })
      .from(game)
      .where(and(eq(game.guildId, guildId), eq(game.id, gameId)));
    if (!selected || !canAccessGameConsent(true, selected.mode)) {
      throw new ActionError('Game content boundaries are not available.');
    }
    // No admin bypass: Requested requires membership; Optional also requires
    // explicit coordinator assignment. Check before reading any answers.
    const [membership] = await db
      .select({ coordinator: gameMember.isConsentCoordinator })
      .from(gameMember)
      .where(
        and(
          eq(gameMember.gameId, selected.id),
          eq(gameMember.discordUserId, access.discordAccount.userId),
        ),
      );
    if (!membership || (selected.mode === 'optional' && !membership.coordinator)) {
      throw new ActionError('Game content boundaries are not available.');
    }
    const topics = await db
      .select({
        id: consentTopic.id,
        name: consentTopic.name,
        parentTopicId: consentTopic.parentTopicId,
      })
      .from(consentTopic)
      .where(and(eq(consentTopic.guildId, guildId), isNull(consentTopic.ownerDiscordUserId)))
      .orderBy(asc(consentTopic.sortOrder), asc(consentTopic.createdAt), asc(consentTopic.name));
    const members = await db
      .select({ discordUserId: gameMember.discordUserId })
      .from(gameMember)
      .where(eq(gameMember.gameId, selected.id));
    const responses =
      topics.length && members.length
        ? await db
            .select({
              discordUserId: consentResponse.discordUserId,
              topicId: consentResponse.topicId,
              answer: consentResponse.answer,
              headsUp: consentResponse.headsUp,
            })
            .from(consentResponse)
            .where(
              and(
                eq(consentResponse.guildId, guildId),
                inArray(
                  consentResponse.discordUserId,
                  members.map((m) => m.discordUserId),
                ),
                inArray(
                  consentResponse.topicId,
                  topics.map((t) => t.id),
                ),
              ),
            )
        : [];
    const [overallGroupNote] = await db
      .select({ note: gameConsentGroupNote.note, revision: gameConsentGroupNote.revision })
      .from(gameConsentGroupNote)
      .where(
        and(eq(gameConsentGroupNote.guildId, guildId), eq(gameConsentGroupNote.gameId, gameId)),
      );
    const topicGroupNotes = topics.length
      ? await db
          .select({
            topicId: gameConsentTopicGroupNote.topicId,
            note: gameConsentTopicGroupNote.note,
            revision: gameConsentTopicGroupNote.revision,
          })
          .from(gameConsentTopicGroupNote)
          .where(
            and(
              eq(gameConsentTopicGroupNote.guildId, guildId),
              eq(gameConsentTopicGroupNote.gameId, gameId),
              inArray(
                gameConsentTopicGroupNote.topicId,
                topics.map((topic) => topic.id),
              ),
            ),
          )
      : [];
    const groupNotesByTopic = new Map(
      topicGroupNotes.map(({ topicId, note, revision }) => [topicId, { note, revision }]),
    );
    return {
      gameName: selected.name,
      overallGroupNote: overallGroupNote ?? EMPTY_GROUP_NOTE,
      mode: selected.mode,
      canViewContributions: membership.coordinator,
      topics: aggregateConsentTopics(
        topics,
        members.map((m) => m.discordUserId),
        responses,
      ).map((topic) => ({
        ...topic,
        groupNote: groupNotesByTopic.get(topic.id) ?? EMPTY_GROUP_NOTE,
        hasMissingAnswers: topic.missingAnswers > 0,
        missingAnswers: membership.coordinator ? topic.missingAnswers : null,
      })),
    };
  },
  'Could not load game content boundaries.',
);
