'use server';

import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { ActionError, asResult } from '@/actions/action-helpers';
import { ensureAccess } from '@/actions/auth-helpers';
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
    const { session } = await ensureAccess(guildId);

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
    const { session } = await ensureAccess(guildId);

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
