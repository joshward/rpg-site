import 'server-only';
import { and, eq, min } from 'drizzle-orm';
import { db } from '@/db/db';
import { guild } from '@/db/schema/guild';
import { scheduledSession } from '@/db/schema/games';
import { inactivityGuildTracking, inactivityMemberTracking } from '@/db/schema/inactivity-tracking';
import { getGuildMembers, getGuildRoles } from '@/lib/discord/api';
import { resolveRoleWithGuildRoles } from '@/lib/authn';
import { planMembershipTracking } from '@/lib/inactivity';
import type { GuildMemberModel } from '@/lib/discord/models';

// Internal: callers authorize this guild via ensureAdmin or the cron secret.
// A complete successful census is required before writing ANY eligibility data.
export async function syncGuildInactivityTracking(guildId: string, allowedRoles: string[]) {
  const members: GuildMemberModel[] = [];
  let after: string | undefined;
  while (true) {
    const page = await getGuildMembers({ guildId, after });
    members.push(...page);
    if (page.length < 1000) break;
    const next = page[page.length - 1].user.id;
    if (next === after) throw new Error('Discord membership pagination did not advance');
    after = next;
  }
  // One fresh role lookup for the entire census, not one HTTP call per member.
  const roles = await getGuildRoles({ guildId });
  const lookup = Object.fromEntries(roles.map((role) => [role.id, role]));
  const observations = members.map((member) => ({
    discordUserId: member.user.id,
    eligible:
      !member.user.bot && resolveRoleWithGuildRoles(member.roles, allowedRoles, lookup) !== 'none',
    joinedAt: member.joined_at ?? null,
  }));
  // Tracking timestamps are actual observation instants, NEVER NOW_OVERRIDE.
  // Only the preview's response-cycle evaluation uses the testing clock.
  const observedAt = new Date();
  const synced = await db.transaction(async (tx) => {
    const [currentGuild] = await tx.select().from(guild).where(eq(guild.id, guildId)).for('update');
    if (
      !currentGuild ||
      JSON.stringify([...currentGuild.allowedRoles].sort()) !==
        JSON.stringify([...allowedRoles].sort())
    ) {
      throw new Error('Guild access configuration changed during the membership census; retry');
    }
    const [existingState] = await tx
      .select()
      .from(inactivityGuildTracking)
      .where(eq(inactivityGuildTracking.guildId, guildId));
    const existing = await tx
      .select()
      .from(inactivityMemberTracking)
      .where(eq(inactivityMemberTracking.guildId, guildId));
    if (existing.some((row) => row.lastObservedAt > observedAt)) {
      throw new Error('A newer membership census already committed; retry');
    }
    let state = existingState;
    if (!state) {
      const [firstSchedule] = await tx
        .select({ at: min(scheduledSession.createdAt) })
        .from(scheduledSession)
        .where(eq(scheduledSession.guildId, guildId));
      const at = firstSchedule?.at ? new Date(firstSchedule.at) : null;
      state = {
        guildId,
        initializedAt: observedAt,
        scheduleFallbackAt: at && at <= observedAt ? at : null,
      };
      await tx.insert(inactivityGuildTracking).values(state);
    }
    const tracked = planMembershipTracking({
      guildId,
      observedAt,
      initialized: !!existingState,
      scheduleFallbackAt: state.scheduleFallbackAt,
      existing,
      members: observations,
    });
    for (const row of tracked) {
      const previous = existing.find((r) => r.discordUserId === row.discordUserId);
      if (previous) {
        // Original addition and its provenance are immutable across restoration,
        // rejoin, later schedules, preference saves, and subsequent sweeps.
        await tx
          .update(inactivityMemberTracking)
          .set({
            hasAccess: row.hasAccess,
            lastObservedAt: row.lastObservedAt,
            accessSince: row.accessSince,
            discordJoinedAt: row.discordJoinedAt,
          })
          .where(
            and(
              eq(inactivityMemberTracking.guildId, guildId),
              eq(inactivityMemberTracking.discordUserId, row.discordUserId),
            ),
          );
      } else await tx.insert(inactivityMemberTracking).values(row);
    }
    return { state, tracked };
  });
  return { ...synced, members, observations };
}

export async function sweepInactivityMemberships() {
  const guilds = await db.select().from(guild);
  let succeeded = 0;
  let failed = 0;
  for (const current of guilds) {
    try {
      await syncGuildInactivityTracking(current.id, current.allowedRoles);
      succeeded++;
    } catch {
      failed++;
      // Do not log member data, tokens, connection strings or exception payloads.
      console.error(
        'Inactivity membership census failed for a configured guild; no membership snapshot committed.',
      );
    }
  }
  return { succeeded, failed };
}
