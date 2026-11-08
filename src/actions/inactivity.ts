'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { ensureAdmin } from '@/actions/auth-helpers';
import { ActionError, asResult } from '@/actions/action-helpers';
import { availabilitySubmission } from '@/db/schema/availability';
import { memberPreference } from '@/db/schema/member-preferences';
import { getNow, isDateOverridden } from '@/lib/availability';
import { evaluateInactivity, lastSubmittedMonth } from '@/lib/inactivity';
import { syncGuildInactivityTracking } from '@/lib/inactivity-tracking';

export const getInactivityPreview = asResult(
  'getInactivityPreview',
  async (guildId: string) => {
    const { guildData } = await ensureAdmin(guildId);
    if (!guildData) throw new ActionError('Configure this guild first.');
    if (!guildData.inactivityEnabled) throw new ActionError('Inactivity preview is disabled.');
    // Refreshes membership metadata only. Never preferences, availability or notifications.
    const { state, tracked, members, observations } = await syncGuildInactivityTracking(
      guildId,
      guildData.allowedRoles,
    );
    const now = getNow();
    const threshold = guildData.inactivityThreshold ?? 3;
    const [preferences, submissions] = await Promise.all([
      db.select().from(memberPreference).where(eq(memberPreference.guildId, guildId)),
      db.select().from(availabilitySubmission).where(eq(availabilitySubmission.guildId, guildId)),
    ]);
    // Keep departed/no-access records for tracking, but never include them in
    // the player list or its counts. Eligibility includes guild administrators.
    const eligibleIds = new Set(observations.filter((m) => m.eligible).map((m) => m.discordUserId));
    const rows = members
      .filter((m) => !m.user.bot && eligibleIds.has(m.user.id))
      .map((member) => {
        const discordUserId = member.user.id;
        const tracking = tracked.find((m) => m.discordUserId === discordUserId);
        const sessionsPerMonth =
          preferences.find((p) => p.discordUserId === discordUserId)?.sessionsPerMonth ?? null;
        return {
          discordUserId,
          username: member.user.username,
          avatar: member.user.avatar,
          lastScheduleMonth: lastSubmittedMonth(guildId, discordUserId, submissions),
          displayName:
            member?.nick || member?.user.global_name || member?.user.username || discordUserId,
          sessionsPerMonth,
          ...evaluateInactivity({
            guildId,
            discordUserId,
            now,
            threshold,
            sessionsPerMonth,
            bot: member?.user.bot === true,
            access: observations.find((m) => m.discordUserId === discordUserId)?.eligible === true,
            joinedAt: member?.joined_at ?? null,
            tracking,
            submissions,
          }),
          tracking: tracking
            ? {
                firstEligibleAt: tracking.firstEligibleAt.toISOString(),
                additionSource: tracking.additionSource,
                firstObservedAt: tracking.firstObservedAt.toISOString(),
                lastObservedAt: tracking.lastObservedAt.toISOString(),
                accessSince: tracking.accessSince.toISOString(),
              }
            : null,
        };
      });
    return {
      threshold,
      evaluatedAt: now.toISOString(),
      dateOverridden: isDateOverridden(),
      automationEnabled: false as const,
      trackingInitializedAt: state.initializedAt.toISOString(),
      scheduleFallbackAt: state.scheduleFallbackAt?.toISOString() ?? null,
      members: rows.sort((a, b) => a.displayName.localeCompare(b.displayName)),
    };
  },
  'Unable to refresh inactivity preview. No preferences were changed and no messages were sent.',
);
