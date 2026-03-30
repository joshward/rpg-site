import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';
import { db } from '@/db/db';
import * as authSchema from '@/db/schema/auth';
import { config } from '@/lib/config';

export const auth = betterAuth({
  baseURL: config.siteUrl,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
  user: {
    additionalFields: {
      lastLoginAt: {
        type: 'date',
        defaultValue: null,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await db
            .update(authSchema.user)
            .set({ lastLoginAt: new Date() })
            .where(eq(authSchema.user.id, session.userId));
        },
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60,
    },
  },
  plugins: [nextCookies()],
  socialProviders: {
    discord: {
      clientId: config.discord.clientId,
      clientSecret: config.discord.clientSecret,
      scope: ['guilds'],
    },
  },
});
