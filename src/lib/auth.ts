import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db/db';
import * as authSchema from '@/db/schema/auth';
import { config } from '@/lib/config';

export const auth = betterAuth({
  baseURL: config.siteUrl,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
  plugins: [nextCookies()],
  socialProviders: {
    discord: {
      clientId: config.discord.clientId,
      clientSecret: config.discord.clientSecret,
    },
  },
});
