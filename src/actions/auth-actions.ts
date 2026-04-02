'use server';

import { and, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { account } from '@/db/schema/auth';
import { guild } from '@/db/schema/guild';
import { fetchUserRole } from '@/lib/authn';
import { ActionError, asResult } from '@/actions/action-helpers';
import {
  getSession,
  getUsersDiscordAccount,
  ensureAccess,
  IMPERSONATION_COOKIE,
  IMPERSONATION_GUILD_COOKIE,
} from './auth-helpers';

export const startImpersonation = asResult(
  'startImpersonation',
  async (guildId: string, discordUserId: string) => {
    // We check admin status of the real user first.
    await ensureAccess(guildId);

    // To be safe, let's re-verify the real user's role.
    const session = await getSession();
    if (!session) throw new ActionError('Not logged in');
    const realDiscordAccount = await getUsersDiscordAccount(session.user.id);
    if (!realDiscordAccount) throw new ActionError('Discord account not found');
    const guildData = (await db.select().from(guild).where(eq(guild.id, guildId)))[0];
    const realRole = await fetchUserRole(
      realDiscordAccount.userId,
      guildId,
      guildData?.allowedRoles ?? [],
    );

    if (realRole !== 'admin') {
      throw new ActionError('Only guild administrators can start impersonation.');
    }

    // Find internal user ID for this discord user
    const dbAccounts = await db
      .select()
      .from(account)
      .where(and(eq(account.providerId, 'discord'), eq(account.accountId, discordUserId)));

    const targetAccount = dbAccounts[0];
    if (!targetAccount) {
      throw new ActionError('This user has not logged into Tavern Master yet.');
    }

    const cookieStore = await cookies();
    cookieStore.set(IMPERSONATION_COOKIE, targetAccount.userId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
    });
    cookieStore.set(IMPERSONATION_GUILD_COOKIE, guildId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
    });

    revalidatePath(`/g/${guildId}`);
  },
  'Something went wrong starting impersonation.',
);

export const stopImpersonation = asResult(
  'stopImpersonation',
  async (guildId?: string) => {
    const cookieStore = await cookies();
    cookieStore.delete(IMPERSONATION_COOKIE);
    cookieStore.delete(IMPERSONATION_GUILD_COOKIE);

    if (guildId) {
      revalidatePath(`/g/${guildId}`);
    } else {
      revalidatePath('/');
    }
  },
  'Something went wrong stopping impersonation.',
);
