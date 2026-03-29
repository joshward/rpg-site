'use server';

import { cache } from 'react';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { account } from '@/db/schema/auth';
import { guild } from '@/db/schema/guild';
import { auth } from '@/lib/auth';
import { fetchUserRole } from '@/lib/authn';
import { ActionError, asResult } from '@/actions/action-helpers';
import { availabilitySubmission, availabilityDay } from '@/db/schema/availability';
import {
  getAvailableMonth as getAvailableMonthHelper,
  getDaysInMonth,
  validateDays,
  type YearMonth,
} from '@/lib/availability';

export type AvailabilityStatus = 'available' | 'late' | 'if_needed' | 'unavailable';

export interface DayAvailability {
  /** Day of the month (1-31) */
  day: number;
  status: AvailabilityStatus;
}

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

/**
 * Validates that the current user is a member (or admin) of the given guild.
 * Throws an ActionError if not.
 */
async function requireGuildMembership(sessionUserId: string, guildId: string): Promise<void> {
  const discordAccount = await getUsersDiscordAccount(sessionUserId);
  if (!discordAccount) {
    throw new ActionError('Discord account not linked or session expired. Please sign in again.');
  }

  const guildData = (await db.select().from(guild).where(eq(guild.id, guildId)))[0];
  if (!guildData) {
    throw new ActionError('This guild is not configured.');
  }

  const role = await fetchUserRole(discordAccount.userId, guildId, guildData.allowedRoles);

  if (role === 'none') {
    throw new ActionError('You do not have access to this guild.');
  }
}

export const getAvailableMonthAction = asResult(
  'getAvailableMonthAction',
  async (): Promise<YearMonth | null> => {
    return getAvailableMonthHelper();
  },
  'Something went wrong determining the availability window.',
);

export const getMyAvailability = asResult(
  'getMyAvailability',
  async (guildId: string, year: number, month: number) => {
    const session = await getSession();
    if (!session) {
      throw new ActionError('Not logged in');
    }

    await requireGuildMembership(session.user.id, guildId);

    const submissions = await db
      .select()
      .from(availabilitySubmission)
      .where(
        and(
          eq(availabilitySubmission.guildId, guildId),
          eq(availabilitySubmission.userId, session.user.id),
          eq(availabilitySubmission.year, year),
          eq(availabilitySubmission.month, month),
        ),
      );

    const submission = submissions[0];
    if (!submission) {
      return null;
    }

    const days = await db
      .select()
      .from(availabilityDay)
      .where(eq(availabilityDay.submissionId, submission.id));

    return {
      submissionId: submission.id,
      createdAt: submission.createdAt.toISOString(),
      updatedAt: submission.updatedAt.toISOString(),
      days: days.map((d) => ({
        day: d.day,
        status: d.status as AvailabilityStatus,
      })),
    };
  },
  'Something went wrong fetching your availability.',
);

export const submitAvailability = asResult(
  'submitAvailability',
  async (guildId: string, year: number, month: number, days: DayAvailability[]) => {
    const session = await getSession();
    if (!session) {
      throw new ActionError('Not logged in');
    }

    await requireGuildMembership(session.user.id, guildId);

    // Verify the submission window is open
    const availableMonth = getAvailableMonthHelper();
    if (!availableMonth) {
      throw new ActionError('The availability submission window is not currently open.');
    }

    if (year !== availableMonth.year || month !== availableMonth.month) {
      throw new ActionError('You can only submit availability for the upcoming month.');
    }

    // Validate that all days are valid for this month
    const dayError = validateDays(
      year,
      month,
      days.map((d) => d.day),
    );
    if (dayError) {
      throw new ActionError(dayError);
    }

    // Validate completeness: exactly one entry per day
    const daysInMonth = getDaysInMonth(year, month);
    if (days.length !== daysInMonth) {
      throw new ActionError(
        `You must submit availability for every day of the month (expected ${daysInMonth}, got ${days.length}).`,
      );
    }

    const seenDays = new Set<number>();
    const allowedStatuses: AvailabilityStatus[] = ['available', 'late', 'if_needed', 'unavailable'];
    for (const d of days) {
      if (seenDays.has(d.day)) {
        throw new ActionError(`Duplicate entry for day ${d.day}.`);
      }
      seenDays.add(d.day);
      if (!allowedStatuses.includes(d.status)) {
        throw new ActionError(`Invalid status: ${d.status}`);
      }
    }

    // Upsert submission + replace days in a transaction
    const { submissionId } = await db.transaction(async (tx) => {
      const [submission] = await tx
        .insert(availabilitySubmission)
        .values({
          guildId,
          userId: session.user.id,
          year,
          month,
        })
        .onConflictDoUpdate({
          target: [
            availabilitySubmission.guildId,
            availabilitySubmission.userId,
            availabilitySubmission.year,
            availabilitySubmission.month,
          ],
          set: {
            updatedAt: new Date(),
          },
        })
        .returning({ id: availabilitySubmission.id });

      // Replace day entries — delete old ones first
      await tx.delete(availabilityDay).where(eq(availabilityDay.submissionId, submission.id));

      // Insert new day entries
      await tx.insert(availabilityDay).values(
        days.map((d) => ({
          submissionId: submission.id,
          day: d.day,
          status: d.status,
        })),
      );

      return { submissionId: submission.id };
    });

    return { submissionId };
  },
  'Something went wrong submitting your availability.',
);
