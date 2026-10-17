'use server';

import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/db/db';
import { game, gameMember } from '@/db/schema/games';
import { consentTopic } from '@/db/schema/consent-topics';
import { consentResponse } from '@/db/schema/consent-responses';
import { ensureAdmin, getEffectiveUserContext } from '@/actions/auth-helpers';
import { ActionError, asResult } from '@/actions/action-helpers';
import { canAccessGameConsent, canAccessGuildConsent } from '@/lib/consent/feature-gate';
import { missingConsentTopicIdsFromAnsweredTopics } from '@/lib/consent/completeness';
import { getGuildMembers } from '@/lib/discord/api';
import { TimeSpan } from 'timespan-ts';

/** Only membership and checklist completion leave this server-side read.
 * Query IDs of answered topics, never answer values, heads-up choices or notes. */
export const getGameConsentStatus = asResult(
  'getGameConsentStatus',
  async (guildId: string, gameId: string) => {
    const access = await ensureAdmin(guildId);
    // ensureAccess can fall back to the real admin when the impersonated user
    // cannot access this guild. The active impersonation must still block this
    // private status read, including calls that bypass the page.
    const context = await getEffectiveUserContext(guildId);
    if (
      !context ||
      context.isImpersonating ||
      access.isImpersonating ||
      !canAccessGuildConsent(access.guildData?.consentEnabled === true)
    ) {
      throw new ActionError('Game consent status is not available.');
    }
    if (typeof gameId !== 'string' || !gameId) throw new ActionError('Game not found.');

    const [selectedGame] = await db
      .select({ id: game.id, name: game.name, consentMode: game.consentMode })
      .from(game)
      .where(and(eq(game.guildId, guildId), eq(game.id, gameId)));
    if (!selectedGame) throw new ActionError('Game not found.');
    if (!canAccessGameConsent(true, selectedGame.consentMode)) {
      throw new ActionError('Game consent status is not available.');
    }

    const topics = await db
      .select({ id: consentTopic.id, parentTopicId: consentTopic.parentTopicId })
      .from(consentTopic)
      .where(and(eq(consentTopic.guildId, guildId), isNull(consentTopic.ownerDiscordUserId)))
      .orderBy(asc(consentTopic.sortOrder), asc(consentTopic.createdAt));
    if (!topics.length) {
      return {
        gameName: selectedGame.name,
        mode: selectedGame.consentMode,
        hasTopics: false,
        members: [],
      };
    }

    const members = await db
      .select({ discordUserId: gameMember.discordUserId })
      .from(gameMember)
      .where(eq(gameMember.gameId, selectedGame.id));
    if (!members.length) {
      return {
        gameName: selectedGame.name,
        mode: selectedGame.consentMode,
        hasTopics: true,
        members: [],
      };
    }

    const responses = await db
      .select({
        discordUserId: consentResponse.discordUserId,
        topicId: consentResponse.topicId,
      })
      .from(consentResponse)
      .where(
        and(
          eq(consentResponse.guildId, guildId),
          inArray(
            consentResponse.discordUserId,
            members.map((member) => member.discordUserId),
          ),
          inArray(
            consentResponse.topicId,
            topics.map((topic) => topic.id),
          ),
          isNotNull(consentResponse.answer),
        ),
      );
    const byUser = new Map<string, string[]>();
    for (const response of responses) {
      const answeredTopicIds = byUser.get(response.discordUserId) ?? [];
      answeredTopicIds.push(response.topicId);
      byUser.set(response.discordUserId, answeredTopicIds);
    }

    const discordMembers = await getGuildMembers(
      { guildId },
      { cacheFor: TimeSpan.fromMinutes(5) },
    );
    const names = new Map(
      discordMembers.map((member) => [
        member.user.id,
        member.nick || member.user.global_name || member.user.username,
      ]),
    );
    return {
      gameName: selectedGame.name,
      mode: selectedGame.consentMode,
      hasTopics: true,
      members: members
        .map(({ discordUserId }) => {
          const answeredTopicIds = byUser.get(discordUserId) ?? [];
          return {
            discordUserId,
            displayName: names.get(discordUserId) ?? 'Unknown member',
            status: !answeredTopicIds.length
              ? ('not-started' as const)
              : missingConsentTopicIdsFromAnsweredTopics(topics, answeredTopicIds).length === 0
                ? ('complete' as const)
                : ('in-progress' as const),
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    };
  },
  'Could not load game consent status.',
);
