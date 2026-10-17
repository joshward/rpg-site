'use server';

import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/db/db';
import { game, gameMember } from '@/db/schema/games';
import { consentTopic } from '@/db/schema/consent-topics';
import { consentResponse } from '@/db/schema/consent-responses';
import { ensureAccess, getEffectiveUserContext } from './auth-helpers';
import { asResult } from './action-helpers';
import { canAccessGuildConsent, isConsentFeatureEnabled } from '@/lib/consent/feature-gate';
import { missingConsentTopicIdsFromAnsweredTopics } from '@/lib/consent/completeness';

/** Self-only prompt eligibility. Never return answers, notes, topic IDs or other players' status. */
export const getMyConsentPrompt = asResult(
  'getMyConsentPrompt',
  async (guildId: string) => {
    if (!isConsentFeatureEnabled()) return false;
    const access = await ensureAccess(guildId);
    const context = await getEffectiveUserContext(guildId);
    if (
      !context ||
      context.isImpersonating ||
      access.isImpersonating ||
      !canAccessGuildConsent(access.guildData?.consentEnabled === true)
    )
      return false;
    const discordUserId = access.discordAccount.userId;
    const requested = await db
      .select({ id: game.id })
      .from(game)
      .innerJoin(gameMember, eq(gameMember.gameId, game.id))
      .where(
        and(
          eq(game.guildId, guildId),
          eq(gameMember.discordUserId, discordUserId),
          eq(game.consentMode, 'requested'),
          inArray(game.status, ['active', 'paused']),
        ),
      )
      .limit(1);
    if (!requested.length) return false;

    const topics = await db
      .select({ id: consentTopic.id, parentTopicId: consentTopic.parentTopicId })
      .from(consentTopic)
      .where(and(eq(consentTopic.guildId, guildId), isNull(consentTopic.ownerDiscordUserId)));
    // An empty catalog cannot be completed by the player; don't show an unresolvable prompt.
    if (!topics.length) return false;
    const answered = await db
      .select({ topicId: consentResponse.topicId })
      .from(consentResponse)
      .where(
        and(
          eq(consentResponse.guildId, guildId),
          eq(consentResponse.discordUserId, discordUserId),
          inArray(
            consentResponse.topicId,
            topics.map((topic) => topic.id),
          ),
          isNotNull(consentResponse.answer),
        ),
      );
    return (
      missingConsentTopicIdsFromAnsweredTopics(
        topics,
        answered.map((row) => row.topicId),
      ).length > 0
    );
  },
  'Could not check your checklist completion.',
);
