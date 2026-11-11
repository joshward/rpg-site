import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { account } from '@/db/schema/auth';
import { memberPreference } from '@/db/schema/member-preferences';
import { NO_LIMIT } from '@/lib/preferences';
import { notifyAdmin, generateStandardSimpleMessage } from '@/lib/notifications';

// Internal only, not a callable server action. Callers must authorize the
// player/admin or verify the signed Discord interaction and guild access.
export async function saveMemberPreference({
  guildId,
  discordUserId,
  sessionsPerMonth,
  displayName,
  userId,
  notify = false,
  source,
}: {
  guildId: string;
  discordUserId: string;
  sessionsPerMonth: number;
  displayName: string;
  userId?: string | null;
  notify?: boolean;
  source?: string;
}) {
  let finalUserId = userId;
  if (finalUserId === undefined) {
    const [dbAccount] = await db
      .select()
      .from(account)
      .where(and(eq(account.providerId, 'discord'), eq(account.accountId, discordUserId)));
    finalUserId = dbAccount?.userId || null;
  }
  const existing = await db
    .select({ sessionsPerMonth: memberPreference.sessionsPerMonth })
    .from(memberPreference)
    .where(
      and(eq(memberPreference.guildId, guildId), eq(memberPreference.discordUserId, discordUserId)),
    )
    .limit(1);
  const hasChanged = existing.length === 0 || existing[0].sessionsPerMonth !== sessionsPerMonth;
  await db
    .insert(memberPreference)
    .values({ guildId, discordUserId, userId: finalUserId, sessionsPerMonth })
    .onConflictDoUpdate({
      target: [memberPreference.guildId, memberPreference.discordUserId],
      set: { sessionsPerMonth, inactivityPauseMonth: null, userId: finalUserId },
    });
  if (notify && hasChanged) {
    const displayValue = sessionsPerMonth === NO_LIMIT ? 'No Limit' : sessionsPerMonth;
    const sourceSuffix = source ? ` ${source}` : '';
    await notifyAdmin(
      guildId,
      generateStandardSimpleMessage(
        guildId,
        '🎮 Preferences Updated',
        `**${displayName}** changed preferred games to **${displayValue}**${sourceSuffix}`,
        'info',
      ),
    );
  }
}
