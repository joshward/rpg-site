'use server';

import { revalidatePath } from 'next/cache';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/db';
import { account, user } from '@/db/schema/auth';
import { resolveRoleForGuild } from '@/lib/authn';
import { ActionError, asResult } from '@/actions/action-helpers';
import { ensureAccess, ensureAdmin } from '@/actions/auth-helpers';
import { saveMemberPreference } from '@/lib/save-member-preference';
import { memberPreference } from '@/db/schema/member-preferences';
import { NO_LIMIT } from '@/lib/preferences';
import { getGuildMember, getGuildMembers } from '@/lib/discord/api';
import { getInactivityPreview } from '@/actions/inactivity';
import type { evaluateInactivity } from '@/lib/inactivity';
import { inactivityPause } from '@/db/schema/inactivity-pauses';
import {
  checkedPauseMonths,
  type PlayerInactivityPause,
  type AdminInactivityPause,
} from '@/lib/inactivity-explanation';

// Internal: callers below authorize the player/admin before invoking this read.
async function currentPause(
  guildId: string,
  discordUserId: string,
  pref?: typeof memberPreference.$inferSelect,
): Promise<PlayerInactivityPause | null> {
  if (pref?.sessionsPerMonth !== 0 || !pref.inactivityPauseMonth) return null;
  const [pause] = await db
    .select({ pausedAt: inactivityPause.pausedAt })
    .from(inactivityPause)
    .where(
      and(
        eq(inactivityPause.guildId, guildId),
        eq(inactivityPause.discordUserId, discordUserId),
        eq(inactivityPause.targetMonth, pref.inactivityPauseMonth),
      ),
    );
  return pause ? { pausedAt: pause.pausedAt.toISOString() } : null;
}

export interface AdminMemberInactivity {
  lastScheduleMonth: string | null;
  classification: string;
  details: {
    evaluatedAt: string;
    threshold: number;
    cutoff: string;
    firstCountableMonth: string | null;
    firstEligibleAt: string | null;
    additionSource: string | null;
    months: ReturnType<typeof evaluateInactivity>['months'];
    reasons: string[];
  };
}

export const getMyPreference = asResult(
  'getMyPreference',
  async (guildId: string) => {
    const { discordAccount } = await ensureAccess(guildId);

    const prefs = await db
      .select()
      .from(memberPreference)
      .where(
        and(
          eq(memberPreference.guildId, guildId),
          eq(memberPreference.discordUserId, discordAccount.userId),
        ),
      );

    const pref = prefs[0];
    if (!pref) {
      return { sessionsPerMonth: null, inactivityPause: null };
    }

    return {
      sessionsPerMonth: pref.sessionsPerMonth,
      inactivityPause: await currentPause(guildId, discordAccount.userId, pref),
    };
  },
  'Something went wrong fetching your preferences.',
);

export const setMyPreference = asResult(
  'setMyPreference',
  async (guildId: string, sessionsPerMonth: number) => {
    const { session, discordAccount } = await ensureAccess(guildId);

    // Validate
    if (
      !Number.isInteger(sessionsPerMonth) ||
      sessionsPerMonth < 0 ||
      (sessionsPerMonth > 10 && sessionsPerMonth !== NO_LIMIT)
    ) {
      throw new ActionError('Invalid sessions per month value.');
    }

    await saveMemberPreference({
      guildId,
      discordUserId: discordAccount.userId,
      userId: session.user.id,
      sessionsPerMonth,
      displayName: session.user.name || 'Unknown User',
      notify: true,
    });
    revalidatePath(`/g/${guildId}`);
    revalidatePath(`/g/${guildId}/preferences`);
    revalidatePath(`/g/${guildId}/availability`);
  },
  'Something went wrong saving your preferences.',
);

export const getAdminMemberPreference = asResult(
  'getAdminMemberPreference',
  async (guildId: string, discordUserId: string) => {
    await ensureAdmin(guildId);

    const prefs = await db
      .select()
      .from(memberPreference)
      .where(
        and(
          eq(memberPreference.guildId, guildId),
          eq(memberPreference.discordUserId, discordUserId),
        ),
      );

    const pref = prefs[0];
    if (!pref) {
      return { sessionsPerMonth: null, inactivityPause: null };
    }

    return {
      sessionsPerMonth: pref.sessionsPerMonth,
      inactivityPause: await currentPause(guildId, discordUserId, pref),
    };
  },
  'Something went wrong fetching member preference.',
);

export const getAdminMemberPreferences = asResult(
  'getAdminMemberPreferences',
  async (guildId: string) => {
    const { guildData } = await ensureAdmin(guildId);
    const allowedRoles = guildData?.allowedRoles ?? [];

    const previewResult = guildData?.inactivityEnabled ? await getInactivityPreview(guildId) : null;
    if (previewResult?.type === 'failure') throw new ActionError(previewResult.error);
    const preview = previewResult?.type === 'success' ? previewResult.data : null;

    // The enabled preview already has a complete, role-filtered census. Reuse it
    // rather than making a second, potentially inconsistent Discord snapshot.
    const members = preview
      ? preview.members.map((m) => ({
          user: {
            id: m.discordUserId,
            username: m.username,
            global_name: m.displayName,
            avatar: m.avatar,
            bot: false,
          },
          roles: [] as string[],
          nick: m.displayName,
        }))
      : await getGuildMembers({ guildId });

    // Fetch preferences from DB
    const dbPrefs = await db
      .select()
      .from(memberPreference)
      .where(eq(memberPreference.guildId, guildId));

    const dbPrefsMap = new Map(dbPrefs.map((p) => [p.discordUserId, p]));
    // Historical explanations remain available even with preview/automation off.
    const pauses = await db
      .select()
      .from(inactivityPause)
      .where(eq(inactivityPause.guildId, guildId))
      .orderBy(desc(inactivityPause.pausedAt));
    const lastPauses = new Map<string, typeof inactivityPause.$inferSelect>();
    for (const pause of pauses)
      if (!lastPauses.has(pause.discordUserId)) lastPauses.set(pause.discordUserId, pause);

    // Fetch all accounts for these discord user IDs to see who has logged in
    const discordUserIds = members.map((m) => m.user.id);

    if (discordUserIds.length === 0) {
      return [];
    }

    // Split into chunks if there are too many (inArray might have limits)
    // But 1000 members is probably fine for most DBs.
    const dbAccounts = await db
      .select({ accountId: account.accountId, lastLoginAt: user.lastLoginAt })
      .from(account)
      .innerJoin(user, eq(account.userId, user.id))
      .where(and(eq(account.providerId, 'discord'), inArray(account.accountId, discordUserIds)));

    const loggedInUsersMap = new Map(
      dbAccounts.map((a) => [a.accountId, a.lastLoginAt] as [string, Date | null]),
    );

    // Combine and filter
    const mappedResults = await Promise.all(
      members.map(async (m) => {
        // Exclude bots
        if (m.user.bot) {
          return null;
        }

        // Only include those with allowed roles or are admins
        const role = preview ? 'member' : await resolveRoleForGuild(m.roles, guildId, allowedRoles);
        if (role === 'none') {
          return null;
        }

        const pref = dbPrefsMap.get(m.user.id);
        const lastLoginAt = loggedInUsersMap.get(m.user.id);
        const pause = lastPauses.get(m.user.id);
        const pauseDetails: AdminInactivityPause | null = pause
          ? {
              pausedAt: pause.pausedAt.toISOString(),
              previousSessionsPerMonth: pause.previousSessionsPerMonth,
              threshold: pause.threshold,
              checkedMonths: checkedPauseMonths(pause.evidence),
              dmStatus: pause.dmStatus,
              current:
                pref?.sessionsPerMonth === 0 && pref.inactivityPauseMonth === pause.targetMonth,
            }
          : null;
        const activity = preview?.members.find((p) => p.discordUserId === m.user.id);

        return {
          discordUserId: m.user.id,
          username: m.user.username,
          displayName: m.nick || m.user.global_name || m.user.username,
          avatar: m.user.avatar,
          hasLoggedIn: loggedInUsersMap.has(m.user.id),
          lastLoginAt: lastLoginAt?.toISOString() ?? null,
          sessionsPerMonth: activity ? activity.sessionsPerMonth : (pref?.sessionsPerMonth ?? null),
          lastInactivityPause: pauseDetails,
          inactivity:
            activity && preview
              ? ({
                  lastScheduleMonth: activity.lastScheduleMonth,
                  classification: activity.classification,
                  details: {
                    evaluatedAt: preview.evaluatedAt,
                    threshold: preview.threshold,
                    cutoff: activity.cutoff,
                    firstCountableMonth: activity.firstCountableMonth,
                    firstEligibleAt: activity.tracking?.firstEligibleAt ?? null,
                    additionSource: activity.tracking?.additionSource ?? null,
                    months: activity.months,
                    reasons: activity.reasons,
                  },
                } satisfies AdminMemberInactivity)
              : null,
        };
      }),
    );

    const result = mappedResults.filter((m) => m !== null) as NonNullable<
      (typeof mappedResults)[number]
    >[];

    return result.sort((a, b) => a.displayName.localeCompare(b.displayName));
  },
  'Something went wrong fetching member preferences.',
);

export const setAdminMemberPreference = asResult(
  'setAdminMemberPreference',
  async (guildId: string, discordUserId: string, sessionsPerMonth: number) => {
    await ensureAdmin(guildId);

    // Validate
    if (
      !Number.isInteger(sessionsPerMonth) ||
      sessionsPerMonth < 0 ||
      (sessionsPerMonth > 10 && sessionsPerMonth !== NO_LIMIT)
    ) {
      throw new ActionError('Invalid sessions per month value.');
    }

    // Fetch member from Discord to get a good display name
    let displayName = 'Unknown User';
    try {
      const member = await getGuildMember({ guildId, userId: discordUserId });
      displayName = member.nick || member.user.global_name || member.user.username;
    } catch (e) {
      console.warn(`Failed to fetch Discord member info for ${discordUserId}:`, e);
    }

    await saveMemberPreference({
      guildId,
      discordUserId,
      sessionsPerMonth,
      displayName,
      notify: false,
    });

    revalidatePath(`/g/${guildId}/admin`);
    revalidatePath(`/g/${guildId}`);
    revalidatePath(`/g/${guildId}/preferences`);
    revalidatePath(`/g/${guildId}/availability`);
  },
  'Something went wrong saving member preference.',
);
