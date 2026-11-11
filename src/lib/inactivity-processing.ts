import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { guild } from '@/db/schema/guild';
import { memberPreference } from '@/db/schema/member-preferences';
import { availabilitySubmission } from '@/db/schema/availability';
import { inactivityMemberTracking } from '@/db/schema/inactivity-tracking';
import { inactivityPause } from '@/db/schema/inactivity-pauses';
import { getGuildMember, getGuildRoles } from '@/lib/discord/api';
import { resolveRoleWithGuildRoles } from '@/lib/authn';
import { evaluateInactivity, monthIndex, monthLabel } from '@/lib/inactivity';
import { syncGuildInactivityTracking } from '@/lib/inactivity-tracking';
import { sendDM } from '@/lib/notifications/dm';
import { generateInactivityPauseMessage } from '@/lib/notifications/inactivity-message';
import { getDaysUntilEndOfMonth } from '@/lib/notifications/utils';

// Separate rollout gate: the existing guild flag previously enabled ONLY preview.
export function inactivityAutomationEnabled() {
  return process.env.INACTIVITY_AUTOMATION_ENABLED === 'true';
}

// Internal cron-only entry point. Never called on preference/availability saves.
// Returns ALL already-processed IDs too, so restoration or a failed DM cannot
// cause an ordinary T-4 reminder to follow the explanation on a job retry.
export async function processGuildInactivity(
  guildId: string,
  now: Date,
  availabilityUrl: string,
  guildName = 'this server',
) {
  const suppressed = new Set<string>();
  if (getDaysUntilEndOfMonth(now) !== 4) return suppressed;
  const targetMonth = monthLabel(monthIndex(now) + 1);
  const previous = await db
    .select()
    .from(inactivityPause)
    .where(and(eq(inactivityPause.guildId, guildId), eq(inactivityPause.targetMonth, targetMonth)));
  for (const row of previous) suppressed.add(row.discordUserId);
  // Testing clocks/cron date parameters must not perform historical or future
  // mutations. Existing ordinary reminder preview behavior is unchanged.
  if (
    !inactivityAutomationEnabled() ||
    now.toISOString().slice(0, 10) !== new Date().toISOString().slice(0, 10)
  )
    return suppressed;
  const [settings] = await db.select().from(guild).where(eq(guild.id, guildId));
  if (!settings?.inactivityEnabled) return suppressed;
  const { observations } = await syncGuildInactivityTracking(guildId, settings.allowedRoles);
  for (const observation of observations) {
    if (!observation.eligible || suppressed.has(observation.discordUserId)) continue;
    const discordUserId = observation.discordUserId;
    const changed = await db.transaction(async (tx) => {
      // Serialize against census/settings writes and other inactivity workers.
      const [current] = await tx.select().from(guild).where(eq(guild.id, guildId)).for('update');
      if (!current?.inactivityEnabled || !inactivityAutomationEnabled()) return;
      const key = and(
        eq(inactivityPause.guildId, guildId),
        eq(inactivityPause.discordUserId, discordUserId),
        eq(inactivityPause.targetMonth, targetMonth),
      );
      const [already] = await tx.select().from(inactivityPause).where(key);
      if (already) return { already: true as const };
      const [preference] = await tx
        .select()
        .from(memberPreference)
        .where(
          and(
            eq(memberPreference.guildId, guildId),
            eq(memberPreference.discordUserId, discordUserId),
          ),
        )
        .for('update');
      if (preference?.sessionsPerMonth == null || preference.sessionsPerMonth === 0) return;
      // Uncached Discord evidence, not the preview/census population alone.
      const member = await getGuildMember({ guildId, userId: discordUserId });
      const roles = await getGuildRoles({ guildId });
      const access =
        resolveRoleWithGuildRoles(
          member.roles,
          current.allowedRoles,
          Object.fromEntries(roles.map((r) => [r.id, r])),
        ) !== 'none';
      const [tracking] = await tx
        .select()
        .from(inactivityMemberTracking)
        .where(
          and(
            eq(inactivityMemberTracking.guildId, guildId),
            eq(inactivityMemberTracking.discordUserId, discordUserId),
          ),
        );
      // Protect absent submission rows as well as existing rows. This short
      // SHARE lock also covers old deployed writers without new application
      // locks. No network calls occur while submissions are locked. A completion
      // committed before this lock is always re-read; later saves wait for commit.
      await tx.execute(sql`LOCK TABLE availability_submissions IN SHARE MODE`);
      const submissions = await tx
        .select()
        .from(availabilitySubmission)
        .where(
          and(
            eq(availabilitySubmission.guildId, guildId),
            eq(availabilitySubmission.discordUserId, discordUserId),
          ),
        );
      const evaluation = evaluateInactivity({
        guildId,
        discordUserId,
        now,
        threshold: current.inactivityThreshold,
        sessionsPerMonth: preference.sessionsPerMonth,
        bot: member.user.bot === true,
        access,
        joinedAt: member.joined_at ?? null,
        tracking,
        submissions,
      });
      if (
        !evaluation.wouldPause ||
        !evaluation.atCutoff ||
        now.toISOString().slice(0, 10) !== new Date().toISOString().slice(0, 10)
      )
        return;
      await tx.insert(inactivityPause).values({
        guildId,
        discordUserId,
        targetMonth,
        previousSessionsPerMonth: preference.sessionsPerMonth,
        threshold: current.inactivityThreshold,
        evidence: { months: evaluation.months, cutoff: evaluation.cutoff, tracking },
        dmStatus: 'reserved',
      });
      await tx
        .update(memberPreference)
        .set({ sessionsPerMonth: 0 })
        .where(eq(memberPreference.id, preference.id));
      return {
        already: false as const,
        username: member.user.username,
        checkedMonths: evaluation.months.map((m) => m.month),
      };
    });
    if (!changed) continue;
    suppressed.add(discordUserId);
    if (changed.already) continue;
    // At most one attempt, not guaranteed delivery: Discord cannot participate
    // in the DB transaction. Never retry an ambiguous network outcome.
    const message = generateInactivityPauseMessage({
      guildId,
      guildName,
      checkedMonths: changed.checkedMonths,
      availabilityUrl,
    });
    let dmStatus: 'sent' | 'failed' | 'blocked' = 'failed';
    try {
      const result = await sendDM(discordUserId, changed.username, message, 'Inactivity pause');
      dmStatus = result === true ? 'sent' : result === false ? 'failed' : 'blocked';
    } catch {
      // Keep zeroing committed even if delivery fails.
    }
    await db
      .update(inactivityPause)
      .set({ dmStatus, dmFinishedAt: new Date() })
      .where(
        and(
          eq(inactivityPause.guildId, guildId),
          eq(inactivityPause.discordUserId, discordUserId),
          eq(inactivityPause.targetMonth, targetMonth),
        ),
      );
  }
  return suppressed;
}
