'use server';

import { cache } from 'react';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { account } from '@/db/schema/auth';
import { auth } from '@/lib/auth';
import { fetchUserRole, fetchUsersGuilds } from '@/lib/authn';
import { ActionError, asResult } from '@/actions/action-helpers';

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

      const role = await fetchUserRole(discordAccount.userId, guildId);

      return {
        role,
      };
    },
    'Something went wrong fetching guild info. Please try again later.',
  ),
);
