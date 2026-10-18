'use server';

import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/db';
import { game, gameMember } from '@/db/schema/games';
import { consentTopic } from '@/db/schema/consent-topics';
import { consentChecklist, consentResponse } from '@/db/schema/consent-responses';
import { ensureAccess, getEffectiveUserContext } from './auth-helpers';
import { ActionError, asResult } from './action-helpers';
import { canAccessGameConsent, canAccessGuildConsent } from '@/lib/consent/feature-gate';
import { getGuildMembers } from '@/lib/discord/api';
import { TimeSpan } from 'timespan-ts';

async function coordinatorMembers(guildId: string, gameId: string) {
  const access = await ensureAccess(guildId);
  const context = await getEffectiveUserContext(guildId);
  if (
    !context ||
    context.isImpersonating ||
    access.isImpersonating ||
    !canAccessGuildConsent(access.guildData?.consentEnabled === true)
  ) {
    throw new ActionError('Private consent details are not available.');
  }
  if (typeof gameId !== 'string' || !gameId) throw new ActionError('Game not found.');
  const [selected] = await db
    .select({ mode: game.consentMode })
    .from(game)
    .where(and(eq(game.guildId, guildId), eq(game.id, gameId)));
  if (!selected || !canAccessGameConsent(true, selected.mode)) {
    throw new ActionError('Private consent details are not available.');
  }
  const [assignment] = await db
    .select({ id: gameMember.id })
    .from(gameMember)
    .where(
      and(
        eq(gameMember.gameId, gameId),
        eq(gameMember.discordUserId, access.discordAccount.userId),
        eq(gameMember.isConsentCoordinator, true),
      ),
    );
  if (!assignment) throw new ActionError('Private consent details are not available.');
  return db
    .select({ discordUserId: gameMember.discordUserId })
    .from(gameMember)
    .where(eq(gameMember.gameId, gameId));
}

async function memberNames(guildId: string) {
  const members = await getGuildMembers({ guildId }, { cacheFor: TimeSpan.fromMinutes(5) });
  return new Map(
    members.map((member) => [
      member.user.id,
      member.nick || member.user.global_name || member.user.username,
    ]),
  );
}

export const getGameConsentTopicDetails = asResult(
  'getGameConsentTopicDetails',
  async (guildId: string, gameId: string, topicId: string) => {
    try {
      const members = await coordinatorMembers(guildId, gameId);
      if (typeof topicId !== 'string' || !topicId) throw new ActionError('Topic not found.');
      const [topic] = await db
        .select({ id: consentTopic.id, parentTopicId: consentTopic.parentTopicId })
        .from(consentTopic)
        .where(
          and(
            eq(consentTopic.guildId, guildId),
            eq(consentTopic.id, topicId),
            isNull(consentTopic.ownerDiscordUserId),
          ),
        );
      if (!topic) throw new ActionError('Topic not found.');
      const responses = members.length
        ? await db
            .select({
              discordUserId: consentResponse.discordUserId,
              topicId: consentResponse.topicId,
              answer: consentResponse.answer,
              headsUp: consentResponse.headsUp,
              note: consentResponse.note,
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
                  topic.parentTopicId ? [topic.id, topic.parentTopicId] : [topic.id],
                ),
              ),
            )
        : [];
      const names = await memberNames(guildId);
      return members
        .map(({ discordUserId }) => {
          const own = responses.find(
            (row) => row.discordUserId === discordUserId && row.topicId === topic.id,
          );
          const parent = responses.find(
            (row) => row.discordUserId === discordUserId && row.topicId === topic.parentTopicId,
          );
          const effective = own?.answer != null ? own : parent;
          return {
            discordUserId,
            displayName: names.get(discordUserId) ?? 'Unknown member',
            answer: effective?.answer ?? null,
            headsUp: effective?.headsUp ?? false,
            source:
              own?.answer != null
                ? ('explicit' as const)
                : parent?.answer != null
                  ? ('inherited' as const)
                  : ('unanswered' as const),
            note: own?.note ?? null,
            parentNote: own?.answer == null && parent?.answer != null ? parent.note : null,
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (error) {
      // Never log unexpected DB errors that could contain private response data.
      if (error instanceof ActionError) throw error;
      throw new ActionError('Could not load private topic details.');
    }
  },
  'Could not load private topic details.',
);

export const getGameConsentOverallNotes = asResult(
  'getGameConsentOverallNotes',
  async (guildId: string, gameId: string) => {
    try {
      const members = await coordinatorMembers(guildId, gameId);
      const notes = members.length
        ? await db
            .select({
              discordUserId: consentChecklist.discordUserId,
              overallNote: consentChecklist.overallNote,
            })
            .from(consentChecklist)
            .where(
              and(
                eq(consentChecklist.guildId, guildId),
                inArray(
                  consentChecklist.discordUserId,
                  members.map((member) => member.discordUserId),
                ),
              ),
            )
        : [];
      const names = await memberNames(guildId);
      return members
        .map(({ discordUserId }) => ({
          discordUserId,
          displayName: names.get(discordUserId) ?? 'Unknown member',
          note: notes.find((row) => row.discordUserId === discordUserId)?.overallNote ?? null,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (error) {
      if (error instanceof ActionError) throw error;
      throw new ActionError('Could not load private overall notes.');
    }
  },
  'Could not load private overall notes.',
);
