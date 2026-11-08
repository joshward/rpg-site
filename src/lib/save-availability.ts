import 'server-only';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { availabilitySubmission, availabilityDay } from '@/db/schema/availability';
import { account } from '@/db/schema/auth';
import { isMonthScheduled } from '@/actions/games';
import { isSuccess } from '@/actions/result';
import { notifyAdmin, generateStandardSimpleMessage } from '@/lib/notifications';
import { getDaysInMonth, validateDays } from '@/lib/availability';
import type { DayAvailability } from '@/actions/availability';

// Internal only: callers must authorize the member (or verify the Discord interaction signature).
export async function saveAvailability({
  guildId,
  discordUserId,
  year,
  month,
  days,
  displayName,
  userId,
  source,
  completionSource = 'player',
}: {
  guildId: string;
  discordUserId: string;
  year: number;
  month: number;
  days: DayAvailability[];
  displayName: string;
  userId?: string | null;
  source?: string;
  completionSource?: 'player' | 'admin';
}) {
  if (
    validateDays(
      year,
      month,
      days.map((d) => d.day),
    ) ||
    days.length !== getDaysInMonth(year, month) ||
    new Set(days.map((d) => d.day)).size !== days.length ||
    days.some((d) => !['available', 'late', 'if_needed', 'unavailable'].includes(d.status))
  ) {
    throw new Error('A full valid monthly submission is required');
  }
  const finalUserId =
    userId === undefined
      ? ((
          await db
            .select()
            .from(account)
            .where(and(eq(account.providerId, 'discord'), eq(account.accountId, discordUserId)))
        )[0]?.userId ?? null)
      : userId;
  const existing = await db
    .select({ id: availabilitySubmission.id })
    .from(availabilitySubmission)
    .where(
      and(
        eq(availabilitySubmission.guildId, guildId),
        eq(availabilitySubmission.discordUserId, discordUserId),
        eq(availabilitySubmission.year, year),
        eq(availabilitySubmission.month, month),
      ),
    )
    .limit(1);
  const scheduled = await isMonthScheduled(guildId, year, month);
  const isScheduled = isSuccess(scheduled) && scheduled.data;
  const { submissionId } = await db.transaction(async (tx) => {
    const completedAt = new Date();
    const [submission] = await tx
      .insert(availabilitySubmission)
      .values({
        guildId,
        discordUserId,
        userId: finalUserId,
        year,
        month,
        completedAt,
        completionSource,
      })
      .onConflictDoUpdate({
        target: [
          availabilitySubmission.guildId,
          availabilitySubmission.discordUserId,
          availabilitySubmission.year,
          availabilitySubmission.month,
        ],
        set: { userId: finalUserId, updatedAt: completedAt, completedAt, completionSource },
      })
      .returning({ id: availabilitySubmission.id });
    await tx.delete(availabilityDay).where(eq(availabilityDay.submissionId, submission.id));
    await tx
      .insert(availabilityDay)
      .values(days.map((d) => ({ submissionId: submission.id, day: d.day, status: d.status })));
    return { submissionId: submission.id };
  });
  revalidatePath(`/g/${guildId}/availability`);
  revalidatePath(`/g/${guildId}/schedule`);
  if (!existing.length || isScheduled) {
    const modified = isScheduled && existing.length > 0;
    await notifyAdmin(
      guildId,
      generateStandardSimpleMessage(
        guildId,
        modified ? '📅 Availability Updated (Schedule Modified)' : '📅 Availability Saved',
        `**${displayName}** submitted availability for **${month}/${year}**${source ? ` ${source}` : ''}`,
        modified ? 'warning' : 'info',
      ),
    );
  }
  return { submissionId };
}
