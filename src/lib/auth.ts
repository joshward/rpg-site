import { betterAuth, GenericEndpointContext } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db/db';
import * as authSchema from '@/db/schema/auth';
import { config } from '@/lib/config';

async function getUsersDiscordAccount(
  userId: string,
  ctx: GenericEndpointContext,
): Promise<{ accessToken: string; userId: string } | undefined> {
  const accounts = await ctx.context.internalAdapter.findAccounts(userId);
  const discordAccount = accounts.find((account) => account.providerId === 'discord');
  return discordAccount?.accessToken && discordAccount.accountId
    ? { accessToken: discordAccount.accessToken, userId: discordAccount.accountId }
    : undefined;
}

export const auth = betterAuth({
  baseURL: config.siteUrl,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60,
    },
  },
  plugins: [
    nextCookies(),
    // customSession(async ({ user, session }, ctx) => {
    //   const discordAccount = await getUsersDiscordAccount(user.id, ctx);
    //   const roles = discordAccount
    //     ? await getUsersRoles(discordAccount.userId, discordAccount.accessToken)
    //     : [];
    //
    //   return {
    //     roles,
    //     user,
    //     session,
    //   };
    // }),
  ],
  socialProviders: {
    discord: {
      clientId: config.discord.clientId,
      clientSecret: config.discord.clientSecret,
      scope: ['guilds'],
    },
  },
});
