import { cache } from 'react';
import { headers, cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { account } from '@/db/schema/auth';
import { guild } from '@/db/schema/guild';
import { auth } from '@/lib/auth';
import { fetchUserRole } from '@/lib/authn';
import { ActionError } from '@/actions/action-helpers';

export const IMPERSONATION_COOKIE = 'tm_impersonate_user_id';
export const IMPERSONATION_GUILD_COOKIE = 'tm_impersonate_guild_id';

export const getSession = async () => {
  return await auth.api.getSession({
    headers: await headers(),
  });
};

export const getEffectiveUserContext = async (_guildId?: string) => {
  const session = await getSession();
  if (!session) return null;

  const realDiscordAccount = await getUsersDiscordAccount(session.user.id);
  if (!realDiscordAccount) return null;

  const cookieStore = await cookies();
  const impersonatedUserId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  const impersonatedGuildId = cookieStore.get(IMPERSONATION_GUILD_COOKIE)?.value;

  if (impersonatedUserId && impersonatedGuildId) {
    // We verify against the impersonatedGuildId context.
    // If the admin started impersonation in Guild X, they act as the user in all guilds
    // as long as they remain an admin in Guild X.
    const impGuildData = (
      await db.select().from(guild).where(eq(guild.id, impersonatedGuildId))
    )[0];
    const realRoleInImpGuild = await fetchUserRole(
      realDiscordAccount.userId,
      impersonatedGuildId,
      impGuildData?.allowedRoles ?? [],
    );

    if (realRoleInImpGuild === 'admin') {
      const impDiscordAccount = await getUsersDiscordAccount(impersonatedUserId);
      if (impDiscordAccount) {
        return {
          session: { ...session, user: { ...session.user, id: impersonatedUserId } },
          discordAccount: impDiscordAccount,
          isImpersonating: true,
          realUser: session.user,
          impersonatedGuildId,
        };
      }
    }
  }

  return {
    session,
    discordAccount: realDiscordAccount,
    isImpersonating: false,
  };
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

  const realDiscordAccount = await getUsersDiscordAccount(session.user.id);
  if (!realDiscordAccount) {
    throw new ActionError('Discord account not linked or session expired. Please sign in again.');
  }

  const cookieStore = await cookies();
  const impersonatedUserId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  const impersonatedGuildId = cookieStore.get(IMPERSONATION_GUILD_COOKIE)?.value;

  const guildData = (await db.select().from(guild).where(eq(guild.id, guildId)))[0];
  const realRole = await fetchUserRole(
    realDiscordAccount.userId,
    guildId,
    guildData?.allowedRoles ?? [],
  );

  if (realRole === 'none') {
    throw new ActionError("You don't have access to this guild.");
  }

  if (!guildData && realRole !== 'admin') {
    throw new ActionError('This guild is not configured for Tavern Master.');
  }

  if (impersonatedUserId && impersonatedGuildId && realRole === 'admin') {
    const impersonatedDiscordAccount = await getUsersDiscordAccount(impersonatedUserId);

    if (impersonatedDiscordAccount) {
      const impersonatedRole = await fetchUserRole(
        impersonatedDiscordAccount.userId,
        guildId,
        guildData?.allowedRoles ?? [],
      );

      if (impersonatedRole !== 'none') {
        return {
          session: {
            ...session,
            user: { ...session.user, id: impersonatedUserId },
          },
          discordAccount: impersonatedDiscordAccount,
          guildData,
          role: impersonatedRole,
          isImpersonating: true,
          realUser: session.user,
        };
      }
    }
  }

  return {
    session,
    discordAccount: realDiscordAccount,
    guildData,
    role: realRole,
    isImpersonating: false,
  };
};

export const ensureAdmin = async (guildId: string) => {
  const access = await ensureAccess(guildId);

  if (access.role !== 'admin') {
    throw new ActionError('Only guild administrators can perform this action.');
  }

  return access;
};
