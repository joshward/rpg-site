import { db } from '@/db/db';
import { guild as guildTable } from '@/db/schema/guild';
import { game, gameMember } from '@/db/schema/games';
import { memberPreference } from '@/db/schema/member-preferences';
import { availabilitySubmission } from '@/db/schema/availability';
import { eq, and, inArray } from 'drizzle-orm';
import { getGuildMembers, sendDiscordMessage, createDM, getGuilds } from '@/lib/discord/api';
import { resolveRoleForGuild } from '@/lib/authn';
import { getNow, getNextMonth, getDaysInMonth } from '@/lib/availability';
import { config } from '@/lib/config';

const NOTIFICATION_DAYS = [10, 7, 4, 3, 2];

export async function processNotifications(dateOverride?: Date) {
  const now = dateOverride || getNow();
  const daysUntilEnd = getDaysUntilEndOfMonth(now);

  console.log(
    `Cron job run: now=${now.toISOString()}, daysUntilEnd=T-${daysUntilEnd}, isNotificationDay=${NOTIFICATION_DAYS.includes(daysUntilEnd)}`,
  );

  if (!NOTIFICATION_DAYS.includes(daysUntilEnd)) {
    return;
  }

  // Target month is always the NEXT month
  const target = getNextMonth(now);
  const targetMonthName = new Date(Date.UTC(target.year, target.month - 1, 1)).toLocaleDateString(
    'en-US',
    { month: 'long', timeZone: 'UTC' },
  );
  const deadlineDate = getOrdinalDate(
    getDaysInMonth(now.getUTCFullYear(), now.getUTCMonth() + 1) - 2,
  );
  const webappLink = config.siteUrl;

  console.log(
    `Processing notifications for ${now.toISOString()} (T-${daysUntilEnd}). Target: ${targetMonthName} ${target.year}`,
  );

  const guilds = await db.select().from(guildTable);
  const discordGuilds = await getGuilds();
  const discordGuildsMap = new Map(discordGuilds.map((g) => [g.id, g]));

  for (const guildData of guilds) {
    try {
      const discordGuild = discordGuildsMap.get(guildData.id);
      const guildName = discordGuild?.name || 'Discord Server';

      await processGuildNotifications({
        guildData,
        guildName,
        daysUntilEnd,
        target,
        targetMonthName,
        deadlineDate,
        webappLink,
      });
    } catch (error) {
      console.error(`Error processing notifications for guild ${guildData.id}:`, error);
    }
  }
}

async function processGuildNotifications({
  guildData,
  guildName,
  daysUntilEnd,
  target,
  targetMonthName,
  deadlineDate,
  webappLink,
}: {
  guildData: any;
  guildName: string;
  daysUntilEnd: number;
  target: { year: number; month: number };
  targetMonthName: string;
  deadlineDate: string;
  webappLink: string;
}) {
  // 1. Fetch data for cohort identification
  const members = await getGuildMembers({ guildId: guildData.id });
  const prefs = await db
    .select()
    .from(memberPreference)
    .where(eq(memberPreference.guildId, guildData.id));
  const activeGames = await db
    .select()
    .from(game)
    .where(and(eq(game.guildId, guildData.id), eq(game.status, 'active')));
  const activeGameIds = activeGames.map((g) => g.id);

  let gameMemberships: any[] = [];
  if (activeGameIds.length > 0) {
    gameMemberships = await db
      .select()
      .from(gameMember)
      .where(inArray(gameMember.gameId, activeGameIds));
  }

  const submissions = await db
    .select()
    .from(availabilitySubmission)
    .where(
      and(
        eq(availabilitySubmission.guildId, guildData.id),
        eq(availabilitySubmission.year, target.year),
        eq(availabilitySubmission.month, target.month),
      ),
    );

  const submittedUserIds = new Set(submissions.map((s) => s.discordUserId));
  const prefsMap = new Map(prefs.map((p) => [p.discordUserId, p.sessionsPerMonth]));

  // Cohorts
  const corePlayers: any[] = [];
  const optionalPlayers: any[] = [];

  for (const m of members) {
    if (m.user.bot) continue;

    // Check if they have allowed roles
    const role = await resolveRoleForGuild(m.roles, guildData.id, guildData.allowedRoles);
    if (role === 'none') continue;

    // Check if they are inactive (sessionsPerMonth === 0)
    const sessionsPref = prefsMap.get(m.user.id);
    if (sessionsPref === 0) continue;

    // Identify if they are in any active game and if they are required
    const userGames = gameMemberships.filter((gm) => gm.discordUserId === m.user.id);
    const isRequired = userGames.some((gm) => gm.isRequired);

    if (isRequired) {
      corePlayers.push(m);
    } else {
      // Optional if not Core and (in any game OR just a member with allowed roles)
      // The prompt says Optional is Core players (not submitted) OR Optional players (not submitted)
      // If someone has 0 days, they are excluded. Everyone else is either Core or Optional.
      optionalPlayers.push(m);
    }
  }

  const missingCore = corePlayers.filter((p) => !submittedUserIds.has(p.user.id));
  const missingOptional = optionalPlayers.filter((p) => !submittedUserIds.has(p.user.id));

  const isLocal = process.env.NODE_ENV === 'development';
  const prefix = isLocal ? '[LOCAL] ' : '';

  // T-10 (Global channel, no DM)
  if (daysUntilEnd === 10) {
    console.log(`[T-10] Sending global channel notification for ${guildName}`);
    if (guildData.globalNotificationChannelId) {
      await sendDiscordMessage(
        { channelId: guildData.globalNotificationChannelId },
        {
          content: `${prefix}Availability for ${targetMonthName} is now open 👍 Please fill it out when you get a chance. ${webappLink} (Due by the ${deadlineDate})`,
        },
      );
    }
  }

  // T-7 (DM Core players missing)
  if (daysUntilEnd === 7) {
    console.log(`[T-7] Sending DMs to ${missingCore.length} missing core players for ${guildName}`);
    for (const p of missingCore) {
      await sendDM(
        p.user.id,
        p.user.username,
        `${prefix}From ${guildName}: Hey! Roleplaying availability for ${targetMonthName} is open. When you get a chance, please fill it out. Thanks 👍! ${webappLink} (Due by the ${deadlineDate}).`,
        'T-7 Reminder',
      );
    }
  }

  // T-4 (DM Core and Optional players missing)
  if (daysUntilEnd === 4) {
    console.log(
      `[T-4] Sending DMs to ${missingCore.length} missing core and ${missingOptional.length} missing optional players for ${guildName}`,
    );
    for (const p of missingCore) {
      await sendDM(
        p.user.id,
        p.user.username,
        `${prefix}From ${guildName}: Reminder to fill out your roleplaying availability for ${targetMonthName}. I’ll be building the schedule in 4 days. ${webappLink}`,
        'T-4 Core Reminder',
      );
    }
    for (const p of missingOptional) {
      await sendDM(
        p.user.id,
        p.user.username,
        `${prefix}From ${guildName}: Hey! If you’re interested in joining any roleplaying games in ${targetMonthName}, feel free to fill out your availability 👍. I’ll be building the schedule in 4 days. ${webappLink}`,
        'T-4 Optional Reminder',
      );
    }
  }

  // T-3 (Admin report)
  if (daysUntilEnd === 3) {
    console.log(`[T-3] Sending admin report for ${guildName}`);
    if (guildData.adminNotificationChannelId) {
      const msg = `${prefix}Heads up — availability deadline is tomorrow.\nCurrent: ${corePlayers.length - missingCore.length}/${corePlayers.length} core players, ${optionalPlayers.length - missingOptional.length}/${optionalPlayers.length} optional players submitted.`;
      await sendDiscordMessage(
        { channelId: guildData.adminNotificationChannelId },
        { content: msg },
      );
    }
  }

  // T-2 (Final call)
  if (daysUntilEnd === 2) {
    console.log(
      `[T-2] Sending final call DMs to ${missingCore.length} missing core players and channel/admin alerts for ${guildName}`,
    );
    // DM missing core
    for (const p of missingCore) {
      await sendDM(
        p.user.id,
        p.user.username,
        `${prefix}From ${guildName}: Final call — I’m building the schedule today with whoever has submitted availability. ${webappLink}`,
        'T-2 Final Call',
      );
    }

    // Global channel
    if (guildData.globalNotificationChannelId) {
      const submittedCount =
        corePlayers.length - missingCore.length + (optionalPlayers.length - missingOptional.length);
      const totalActive = corePlayers.length + optionalPlayers.length;
      const content = `${prefix}Final call for availability schedule will be created today. ${submittedCount}/${totalActive} players (core + optional) have filled out their schedule.`;
      await sendDiscordMessage(
        { channelId: guildData.globalNotificationChannelId },
        {
          content,
        },
      );
    }

    // DM owner
    if (guildData.adminNotificationChannelId) {
      const msg = `${prefix}Build the schedule today.\nCurrent: ${corePlayers.length - missingCore.length}/${corePlayers.length} core players, ${optionalPlayers.length - missingOptional.length}/${optionalPlayers.length} optional players submitted.`;
      await sendDiscordMessage(
        { channelId: guildData.adminNotificationChannelId },
        { content: msg },
      );
    }
  }
}

async function sendDM(userId: string, username: string, content: string, label: string) {
  const isLocal = process.env.NODE_ENV === 'development';
  if (isLocal && !config.allowedDmRecipients.includes(userId)) {
    console.log(`[LOCAL] DM to ${username} (${userId}) blocked: [${label}]`);
    return;
  }

  try {
    const channel = await createDM({ recipient_id: userId });
    await sendDiscordMessage({ channelId: channel.id }, { content });
    console.log(`DM sent to ${username} (${userId}): [${label}]`);
  } catch (error) {
    console.error(`Failed to send DM to user ${userId}:`, error);
  }
}

function getDaysUntilEndOfMonth(date: Date): number {
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return lastDay - date.getUTCDate();
}

function getOrdinalDate(date: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = date % 100;
  return date + (s[(v - 20) % 10] || s[v] || s[0]);
}
