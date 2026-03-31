import { cache } from 'react';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { account } from '@/db/schema/auth';
import { guild } from '@/db/schema/guild';
import { auth } from '@/lib/auth';
import { fetchUserRole } from '@/lib/authn';
import { ActionError } from '@/actions/action-helpers';

export const getSession = async () => {
  return await auth.api.getSession({
    headers: await headers(),
  });
};

export const getUsersDiscordAccount = cache(
  async (
    userId: string,
  ): Promise<{ accessToken: string; userId: string; expiresAt: Date | null } | undefined> => {
    const accounts = await db.select().from(account).where(eq(account.userId, userId));
    const discordAccount = accounts.find((a) => a.providerId === 'discord');

    if (!discordAccount?.accessToken || !discordAccount.accountId) {
      return undefined;
    }

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

export const ensureAccess = async (guildId: string) => {
  const session = await getSession();
  if (!session) {
    throw new ActionError('Not logged in');
  }

  const discordAccount = await getUsersDiscordAccount(session.user.id);
  if (!discordAccount) {
    throw new ActionError('Discord account not linked or session expired. Please sign in again.');
  }

  const guildData = (await db.select().from(guild).where(eq(guild.id, guildId)))[0];
  if (!guildData) {
    throw new ActionError('This guild is not configured for Tavern Master.');
  }

  const role = await fetchUserRole(discordAccount.userId, guildId, guildData.allowedRoles ?? []);

  if (role === 'none') {
    throw new ActionError("You don't have access to this guild.");
  }

  return { session, discordAccount, guildData, role };
};

export const ensureAdmin = async (guildId: string) => {
  const access = await ensureAccess(guildId);

  if (access.role !== 'admin') {
    throw new ActionError('Only guild administrators can perform this action.');
  }

  return access;
};
