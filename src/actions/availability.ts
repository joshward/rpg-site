'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { ActionError, asResult } from '@/actions/action-helpers';
import { ensureAccess, ensureAdmin } from '@/actions/auth-helpers';
import { availabilitySubmission, availabilityDay } from '@/db/schema/availability';
import { account } from '@/db/schema/auth';
import {
  getEditableMonths,
  getDaysInMonth,
  validateDays,
  isSameMonth,
  type YearMonth,
} from '@/lib/availability';

export type AvailabilityStatus = 'available' | 'late' | 'if_needed' | 'unavailable';

export interface DayAvailability {
  /** Day of the month (1-31) */
  day: number;
  status: AvailabilityStatus;
}

export const getMyAvailability = asResult(
  'getMyAvailability',
  async (guildId: string, year: number, month: number) => {
    const { discordAccount } = await ensureAccess(guildId);

    const submissions = await db
      .select()
      .from(availabilitySubmission)
      .where(
        and(
          eq(availabilitySubmission.guildId, guildId),
          eq(availabilitySubmission.discordUserId, discordAccount.userId),
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
    const { session, discordAccount } = await ensureAccess(guildId);

    // Verify the submission is for an allowed month (current or next)
    const editableMonths = getEditableMonths();
    const targetMonth: YearMonth = { year, month };
    const isAllowed = editableMonths.some((m) => isSameMonth(targetMonth, m));

    if (!isAllowed) {
      throw new ActionError('You can only submit availability for the current or upcoming month.');
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
          discordUserId: discordAccount.userId,
          userId: session.user.id,
          year,
          month,
        })
        .onConflictDoUpdate({
          target: [
            availabilitySubmission.guildId,
            availabilitySubmission.discordUserId,
            availabilitySubmission.year,
            availabilitySubmission.month,
          ],
          set: {
            userId: session.user.id,
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

    revalidatePath(`/g/${guildId}/availability`);
    revalidatePath(`/g/${guildId}/schedule`);

    return { submissionId };
  },
  'Something went wrong submitting your availability.',
);

export const getAdminMemberAvailability = asResult(
  'getAdminMemberAvailability',
  async (guildId: string, year: number, month: number, discordUserId: string) => {
    await ensureAdmin(guildId);

    const submissions = await db
      .select()
      .from(availabilitySubmission)
      .where(
        and(
          eq(availabilitySubmission.guildId, guildId),
          eq(availabilitySubmission.discordUserId, discordUserId),
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
  'Something went wrong fetching member availability.',
);

export const adminSubmitMemberAvailability = asResult(
  'adminSubmitMemberAvailability',
  async (
    guildId: string,
    year: number,
    month: number,
    discordUserId: string,
    days: DayAvailability[],
  ) => {
    await ensureAdmin(guildId);

    // 1. Find the internal user ID for this discord user (if it exists)
    const dbAccounts = await db
      .select()
      .from(account)
      .where(and(eq(account.providerId, 'discord'), eq(account.accountId, discordUserId)));

    const targetAccount = dbAccounts[0];
    const userId = targetAccount?.userId || null;

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
      if (!allowedStatuses.includes(d.status)) {
        throw new ActionError(`Invalid status for day ${d.day}.`);
      }
      seenDays.add(d.day);
    }

    const { submissionId } = await db.transaction(async (tx) => {
      // 2. Upsert submission
      const [submission] = await tx
        .insert(availabilitySubmission)
        .values({
          guildId,
          discordUserId,
          userId,
          year,
          month,
        })
        .onConflictDoUpdate({
          target: [
            availabilitySubmission.guildId,
            availabilitySubmission.discordUserId,
            availabilitySubmission.year,
            availabilitySubmission.month,
          ],
          set: {
            userId,
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

      // Update the submission's updatedAt timestamp
      await tx
        .update(availabilitySubmission)
        .set({ updatedAt: new Date() })
        .where(eq(availabilitySubmission.id, submission.id));

      return { submissionId: submission.id };
    });

    revalidatePath(`/g/${guildId}/availability`);
    revalidatePath(`/g/${guildId}/schedule`);

    return { submissionId };
  },
  'Something went wrong submitting member availability.',
);

export const adminUpdateMemberAvailability = asResult(
  'adminUpdateMemberAvailability',
  async (
    guildId: string,
    year: number,
    month: number,
    discordUserId: string,
    day: number,
    status: AvailabilityStatus | 'unset',
  ) => {
    await ensureAdmin(guildId);

    // 1. Find the internal user ID for this discord user (if it exists)
    const dbAccounts = await db
      .select()
      .from(account)
      .where(and(eq(account.providerId, 'discord'), eq(account.accountId, discordUserId)));

    const targetAccount = dbAccounts[0];
    const userId = targetAccount?.userId || null;

    await db.transaction(async (tx) => {
      // 2. Upsert submission
      const [submission] = await tx
        .insert(availabilitySubmission)
        .values({
          guildId,
          discordUserId,
          userId,
          year,
          month,
        })
        .onConflictDoUpdate({
          target: [
            availabilitySubmission.guildId,
            availabilitySubmission.discordUserId,
            availabilitySubmission.year,
            availabilitySubmission.month,
          ],
          set: {
            userId,
            updatedAt: new Date(),
          },
        })
        .returning();

      // 3. Update or delete day entry
      if (status === 'unset') {
        await tx
          .delete(availabilityDay)
          .where(
            and(eq(availabilityDay.submissionId, submission.id), eq(availabilityDay.day, day)),
          );
      } else {
        await tx
          .insert(availabilityDay)
          .values({
            submissionId: submission.id,
            day,
            status,
          })
          .onConflictDoUpdate({
            target: [availabilityDay.submissionId, availabilityDay.day],
            set: { status },
          });
      }

      // 4. Update the submission's updatedAt timestamp
      await tx
        .update(availabilitySubmission)
        .set({ updatedAt: new Date() })
        .where(eq(availabilitySubmission.id, submission.id));
    });

    revalidatePath(`/g/${guildId}/schedule`);
    revalidatePath(`/g/${guildId}/availability`);
  },
  'Something went wrong updating member availability.',
);
