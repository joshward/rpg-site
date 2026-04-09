'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/db';
import { account, user } from '@/db/schema/auth';
import { resolveRoleForGuild } from '@/lib/authn';
import { ActionError, asResult } from '@/actions/action-helpers';
import { ensureAccess, ensureAdmin } from '@/actions/auth-helpers';
import { notifyAdmin, generateSimpleEmbed } from '@/lib/notifications';
import { memberPreference } from '@/db/schema/member-preferences';
import { NO_LIMIT } from '@/lib/preferences';
import { getGuildMembers } from '@/lib/discord/api';

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
      return { sessionsPerMonth: null };
    }

    return { sessionsPerMonth: pref.sessionsPerMonth };
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

    const existing = await db
      .select({ sessionsPerMonth: memberPreference.sessionsPerMonth })
      .from(memberPreference)
      .where(
        and(
          eq(memberPreference.guildId, guildId),
          eq(memberPreference.discordUserId, discordAccount.userId),
        ),
      )
      .limit(1);

    const hasChanged = existing.length === 0 || existing[0].sessionsPerMonth !== sessionsPerMonth;

    await db
      .insert(memberPreference)
      .values({
        guildId,
        discordUserId: discordAccount.userId,
        userId: session.user.id,
        sessionsPerMonth,
      })
      .onConflictDoUpdate({
        target: [memberPreference.guildId, memberPreference.discordUserId],
        set: {
          sessionsPerMonth,
          userId: session.user.id,
        },
      });

    if (hasChanged) {
      const displayName = session.user.name || 'Unknown User';
      const displayValue = sessionsPerMonth === NO_LIMIT ? 'No Limit' : sessionsPerMonth;
      const message = generateSimpleEmbed(
        '🎮 Preferences Updated',
        `**${displayName}** changed preferred games to **${displayValue}**`,
        'info',
      );
      await notifyAdmin(guildId, message);
    }
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
      return { sessionsPerMonth: null };
    }

    return { sessionsPerMonth: pref.sessionsPerMonth };
  },
  'Something went wrong fetching member preference.',
);

export const getAdminMemberPreferences = asResult(
  'getAdminMemberPreferences',
  async (guildId: string) => {
    const { guildData } = await ensureAdmin(guildId);
    const allowedRoles = guildData?.allowedRoles ?? [];

    // Fetch members from Discord
    const members = await getGuildMembers({ guildId });

    // Fetch preferences from DB
    const dbPrefs = await db
      .select()
      .from(memberPreference)
      .where(eq(memberPreference.guildId, guildId));

    const dbPrefsMap = new Map(dbPrefs.map((p) => [p.discordUserId, p]));

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
        const role = await resolveRoleForGuild(m.roles, guildId, allowedRoles);
        if (role === 'none') {
          return null;
        }

        const pref = dbPrefsMap.get(m.user.id);
        const lastLoginAt = loggedInUsersMap.get(m.user.id);

        return {
          discordUserId: m.user.id,
          username: m.user.username,
          displayName: m.nick || m.user.global_name || m.user.username,
          avatar: m.user.avatar,
          hasLoggedIn: loggedInUsersMap.has(m.user.id),
          lastLoginAt: lastLoginAt?.toISOString() ?? null,
          sessionsPerMonth: pref?.sessionsPerMonth ?? null,
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

    // Check if user has an account in our DB
    const dbAccount = (
      await db
        .select()
        .from(account)
        .where(and(eq(account.providerId, 'discord'), eq(account.accountId, discordUserId)))
    )[0];

    await db
      .insert(memberPreference)
      .values({
        guildId,
        discordUserId,
        userId: dbAccount?.userId || null,
        sessionsPerMonth,
      })
      .onConflictDoUpdate({
        target: [memberPreference.guildId, memberPreference.discordUserId],
        set: {
          sessionsPerMonth,
          userId: dbAccount?.userId || null,
        },
      });

    revalidatePath(`/g/${guildId}/admin`);
  },
  'Something went wrong saving member preference.',
);
