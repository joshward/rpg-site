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

const getUsersDiscordAccount = cache(
  async (userId: string): Promise<{ accessToken: string; userId: string } | undefined> => {
    const accounts = await db.select().from(account).where(eq(account.userId, userId));
    const discordAccount = accounts.find((account) => account.providerId === 'discord');
    return discordAccount?.accessToken && discordAccount.accountId
      ? { accessToken: discordAccount.accessToken, userId: discordAccount.accountId }
      : undefined;
  },
);

const getSession = cache(async () => {
  return await auth.api.getSession({
    headers: await headers(),
  });
});

export const getUsersGuilds = cache(
  asResult(
    'getUsersGuilds',
    async () => {
      const session = await getSession();

      if (!session) {
        return null;
      }

      const discordAccount = await getUsersDiscordAccount(session.user.id);

      const userGuilds = discordAccount
        ? await fetchUsersGuilds(discordAccount.userId, discordAccount.accessToken)
        : [];

      return userGuilds.map((guild) => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
      }));
    },
    'Something went wrong while fetching your guilds. Please try again later.',
  ),
);

export const getGuildInfo = cache(
  asResult(
    'getGuildInfo',
    async (guildId: string) => {
      const session = await getSession();

      if (!session) {
        throw new ActionError('Not logged in');
      }

      const discordAccount = await getUsersDiscordAccount(session.user.id);
      if (!discordAccount) {
        throw new Error(`No Discord account linked for ${session.user.id}`);
      }

      const guildData = (await db.select().from(guild).where(eq(guild.id, guildId)))[0];

      const role = await fetchUserRole(
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
  ),
);

export const getGuildRolesAction = cache(
  asResult(
    'getGuildRolesAction',
    async (guildId: string) => {
      const session = await getSession();

      if (!session) {
        throw new ActionError('Not logged in');
      }

      const discordAccount = await getUsersDiscordAccount(session.user.id);
      if (!discordAccount) {
        throw new Error(`No Discord account linked for ${session.user.id}`);
      }

      const roles = await getGuildRoles({ guildId }, { cacheFor: TimeSpan.fromMinutes(30) });

      return roles.map((role) => ({
        id: role.id,
        label: role.name,
      }));
    },
    'Something went wrong fetching guild roles. Please try again later.',
  ),
);
