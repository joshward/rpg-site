'use server';

import { cache } from 'react';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/db';
import { account } from '@/db/schema/auth';
import { guild } from '@/db/schema/guild';
import { auth } from '@/lib/auth';
import { fetchUserRole, resolveRoleForGuild } from '@/lib/authn';
import { ActionError, asResult } from '@/actions/action-helpers';
import { memberPreference } from '@/db/schema/member-preferences';
import { NO_LIMIT } from '@/lib/preferences';
import { getGuildMembers } from '@/lib/discord/api';

const getSession = async () => {
  return await auth.api.getSession({
    headers: await headers(),
  });
};

const getUsersDiscordAccount = cache(
  async (userId: string): Promise<{ accessToken: string; userId: string } | undefined> => {
    const accounts = await db.select().from(account).where(eq(account.userId, userId));
    const discordAccount = accounts.find((a) => a.providerId === 'discord');

    if (!discordAccount?.accessToken || !discordAccount.accountId) {
      return undefined;
    }

    const isExpired =
      discordAccount.accessTokenExpiresAt &&
      discordAccount.accessTokenExpiresAt.getTime() - 60000 < Date.now();

    if (isExpired) {
      return undefined;
    }

    return {
      accessToken: discordAccount.accessToken,
      userId: discordAccount.accountId,
    };
  },
);

const ensureAdmin = async (guildId: string) => {
  const session = await getSession();
  if (!session) {
    throw new ActionError('Not logged in');
  }

  const discordAccount = await getUsersDiscordAccount(session.user.id);
  if (!discordAccount) {
    throw new ActionError('Discord account not linked or session expired. Please sign in again.');
  }

  const guildData = (await db.select().from(guild).where(eq(guild.id, guildId)))[0];

  const role = await fetchUserRole(discordAccount.userId, guildId, guildData?.allowedRoles ?? []);

  if (role !== 'admin') {
    throw new ActionError('Only guild administrators can perform this action.');
  }

  return { session, discordAccount, guildData };
};

export const getMyPreference = asResult(
  'getMyPreference',
  async (guildId: string) => {
    const session = await getSession();
    if (!session) {
      throw new ActionError('Not logged in');
    }

    const discordAccount = await getUsersDiscordAccount(session.user.id);
    if (!discordAccount) {
      throw new ActionError('Discord account not linked or session expired. Please sign in again.');
    }

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
    const session = await getSession();
    if (!session) {
      throw new ActionError('Not logged in');
    }

    const discordAccount = await getUsersDiscordAccount(session.user.id);
    if (!discordAccount) {
      throw new ActionError('Discord account not linked or session expired. Please sign in again.');
    }

    // Validate
    if (
      !Number.isInteger(sessionsPerMonth) ||
      sessionsPerMonth < 0 ||
      (sessionsPerMonth > 10 && sessionsPerMonth !== NO_LIMIT)
    ) {
      throw new ActionError('Invalid sessions per month value.');
    }

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
  },
  'Something went wrong saving your preferences.',
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

    // Fetch all accounts for these discord user IDs to see who has logged in
    const discordUserIds = members.map((m) => m.user.id);

    if (discordUserIds.length === 0) {
      return [];
    }

    // Split into chunks if there are too many (inArray might have limits)
    // But 1000 members is probably fine for most DBs.
    const dbAccounts = await db
      .select({ accountId: account.accountId })
      .from(account)
      .where(and(eq(account.providerId, 'discord'), inArray(account.accountId, discordUserIds)));

    const loggedInDiscordIds = new Set(dbAccounts.map((a) => a.accountId));

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

        const pref = dbPrefs.find((p) => p.discordUserId === m.user.id);
        return {
          discordUserId: m.user.id,
          username: m.user.username,
          displayName: m.nick || m.user.global_name || m.user.username,
          avatar: m.user.avatar,
          hasLoggedIn: loggedInDiscordIds.has(m.user.id),
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
