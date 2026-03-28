'use server';

import { cache } from 'react';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { account } from '@/db/schema/auth';
import { auth } from '@/lib/auth';
import { fetchUserRole, fetchUsersGuilds } from '@/lib/authn';
import { ActionError, asResult } from '@/actions/action-helpers';
import { guild } from '@/db/schema/guild';
import { getGuildRoles } from '@/lib/discord/api';
import { TimeSpan } from 'timespan-ts';
import { revalidatePath } from 'next/cache';

const fetchUsersGuildsCached = cache(fetchUsersGuilds);
const fetchUserRoleCached = cache(fetchUserRole);
const getGuildRolesCached = cache((guildId: string) =>
  getGuildRoles({ guildId }, { cacheFor: TimeSpan.fromMinutes(30) }),
);

const getUsersDiscordAccount = cache(
  async (
    userId: string,
  ): Promise<{ accessToken: string; userId: string; expiresAt: Date | null } | undefined> => {
    const accounts = await db.select().from(account).where(eq(account.userId, userId));
    const discordAccount = accounts.find((account) => account.providerId === 'discord');

    if (!discordAccount?.accessToken || !discordAccount.accountId) {
      return undefined;
    }

    // Treat as expired if we are within 1 minute of the expiration date
    const isExpired =
      discordAccount.accessTokenExpiresAt &&
      discordAccount.accessTokenExpiresAt.getTime() - 60000 < Date.now();

    if (isExpired) {
      console.warn(`Discord access token for user ${userId} has expired.`);
      return undefined;
    }

    return {
      accessToken: discordAccount.accessToken,
      userId: discordAccount.accountId,
      expiresAt: discordAccount.accessTokenExpiresAt,
    };
  },
);

const getSession = async () => {
  return await auth.api.getSession({
    headers: await headers(),
  });
};

export const getUsersGuilds = asResult(
  'getUsersGuilds',
  async () => {
    const session = await getSession();

    if (!session) {
      return null;
    }

    const discordAccount = await getUsersDiscordAccount(session.user.id);

    return discordAccount
      ? await fetchUsersGuildsCached(discordAccount.userId, discordAccount.accessToken)
      : [];
  },
  'Something went wrong while fetching your guilds. Please try again later.',
);

export const getGuildInfo = asResult(
  'getGuildInfo',
  async (guildId: string) => {
    const session = await getSession();

    if (!session) {
      throw new ActionError('Not logged in');
    }

    const discordAccount = await getUsersDiscordAccount(session.user.id);
    if (!discordAccount) {
      throw new ActionError('Discord account not linked or session expired. Please sign in again.');
    }

    const guildData = (await db.select().from(guild).where(eq(guild.id, guildId)))[0];

    const role = await fetchUserRoleCached(
      discordAccount.userId,
      guildId,
      guildData?.allowedRoles ?? [],
    );

    if (role === 'none') {
      return {
        isConfigured: false,
        role: 'none',
        allowedRoles: [],
      };
    }

    return {
      isConfigured: Boolean(guildData),
      role,
      allowedRoles: guildData?.allowedRoles ?? [],
    };
  },
  'Something went wrong fetching guild info. Please try again later.',
);

export const getGuildRolesAction = asResult(
  'getGuildRolesAction',
  async (guildId: string) => {
    const session = await getSession();

    if (!session) {
      throw new ActionError('Not logged in');
    }

    const discordAccount = await getUsersDiscordAccount(session.user.id);
    if (!discordAccount) {
      throw new ActionError('Discord account not linked or session expired. Please sign in again.');
    }

    const roles = await getGuildRolesCached(guildId);

    return roles.map((role) => ({
      id: role.id,
      label: role.name,
    }));
  },
  'Something went wrong fetching guild roles. Please try again later.',
);

export const saveGuildConfig = asResult(
  'saveGuildConfig',
  async (guildId: string, allowedRoles: string[]) => {
    const session = await getSession();

    if (!session) {
      throw new ActionError('Not logged in');
    }

    const discordAccount = await getUsersDiscordAccount(session.user.id);
    if (!discordAccount) {
      throw new ActionError('Discord account not linked or session expired. Please sign in again.');
    }

    const role = await fetchUserRoleCached(discordAccount.userId, guildId, []);

    if (role !== 'admin') {
      throw new ActionError('Only guild administrators can change guild settings');
    }

    await db
      .insert(guild)
      .values({
        id: guildId,
        allowedRoles,
      })
      .onConflictDoUpdate({
        target: guild.id,
        set: {
          allowedRoles,
        },
      });

    revalidatePath(`/g/${guildId}/admin`);
    revalidatePath(`/g/${guildId}`);
  },
  'Something went wrong saving guild settings. Please try again later.',
);
