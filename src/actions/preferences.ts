'use server';

import { cache } from 'react';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { account } from '@/db/schema/auth';
import { auth } from '@/lib/auth';
import { ActionError, asResult } from '@/actions/action-helpers';
import { memberPreference } from '@/db/schema/member-preferences';
import { NO_LIMIT } from '@/lib/preferences';

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
