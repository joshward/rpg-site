import { db } from '@/db/db';
import { guild as guildTable } from '@/db/schema/guild';
import { getGuilds } from '@/lib/discord/api';
import { getNow, getNextMonth } from '@/lib/availability';
import { config } from '@/lib/config';
import { getDaysUntilEndOfMonth, getPrefix } from './utils';
import { getNotificationContext } from './messages';
import {
  sendT7Reminder,
  sendT4CoreReminder,
  sendT4OptionalReminder,
  sendT2FinalCall,
} from './dm-actions';
import {
  sendT10Global,
  sendT3AdminReportAction,
  sendT2FinalCallGlobalAction,
  sendT2AdminReportAction,
} from './global-actions';
import { getPlayerCohorts } from './cohorts';

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

  const target = getNextMonth(now);
  const prefix = getPrefix();

  const guilds = await db.select().from(guildTable);
  const discordGuilds = await getGuilds();
  const discordGuildsMap = new Map(discordGuilds.map((g) => [g.id, g]));

  for (const guildData of guilds) {
    try {
      const discordGuild = discordGuildsMap.get(guildData.id);
      const guildName = discordGuild?.name || 'Discord Server';
      const guildWebappLink = `${config.siteUrl}/g/${guildData.id}/availability`;
      const context = getNotificationContext(now, guildData.id, guildName, guildWebappLink, prefix);

      console.log(
        `Processing notifications for ${guildName} (T-${daysUntilEnd}). Target: ${context.targetMonthName} ${target.year}`,
      );

      const cohorts = await getPlayerCohorts({
        guildId: guildData.id,
        allowedRoles: guildData.allowedRoles,
        target,
      });

      const { missingCore, missingOptional, corePlayers, optionalPlayers } = cohorts;

      // T-10 (Global channel, no DM)
      if (daysUntilEnd === 10) {
        console.log(`[T-10] Sending global channel notification for ${guildName}`);
        if (guildData.globalNotificationChannelId) {
          await sendT10Global(guildData.globalNotificationChannelId, context);
        }
      }

      // T-7 (DM Core players missing)
      if (daysUntilEnd === 7) {
        console.log(
          `[T-7] Sending DMs to ${missingCore.length} missing core players for ${guildName}`,
        );
        for (const p of missingCore) {
          await sendT7Reminder(p.user.id, p.user.username, context);
        }
      }

      // T-4 (DM Core and Optional players missing)
      if (daysUntilEnd === 4) {
        console.log(
          `[T-4] Sending DMs to ${missingCore.length} missing core and ${missingOptional.length} missing optional players for ${guildName}`,
        );
        for (const p of missingCore) {
          await sendT4CoreReminder(p.user.id, p.user.username, context);
        }
        for (const p of missingOptional) {
          await sendT4OptionalReminder(p.user.id, p.user.username, context);
        }
      }

      // T-3 (Admin report)
      if (daysUntilEnd === 3) {
        console.log(`[T-3] Sending admin report for ${guildName}`);
        if (guildData.adminNotificationChannelId) {
          await sendT3AdminReportAction(guildData.adminNotificationChannelId, context, {
            corePlayersCount: corePlayers.length,
            missingCoreCount: missingCore.length,
            optionalPlayersCount: optionalPlayers.length,
            missingOptionalCount: missingOptional.length,
          });
        }
      }

      // T-2 (Final call)
      if (daysUntilEnd === 2) {
        console.log(
          `[T-2] Sending final call DMs to ${missingCore.length} missing core players and channel/admin alerts for ${guildName}`,
        );
        for (const p of missingCore) {
          await sendT2FinalCall(p.user.id, p.user.username, context);
        }

        if (guildData.globalNotificationChannelId) {
          const submittedCount =
            corePlayers.length -
            missingCore.length +
            (optionalPlayers.length - missingOptional.length);
          const totalActive = corePlayers.length + optionalPlayers.length;
          await sendT2FinalCallGlobalAction(guildData.globalNotificationChannelId, context, {
            submittedCount,
            totalActive,
          });
        }

        if (guildData.adminNotificationChannelId) {
          await sendT2AdminReportAction(guildData.adminNotificationChannelId, context, {
            corePlayersCount: corePlayers.length,
            missingCoreCount: missingCore.length,
            optionalPlayersCount: optionalPlayers.length,
            missingOptionalCount: missingOptional.length,
          });
        }
      }
    } catch (error) {
      console.error(`Error processing notifications for guild ${guildData.id}:`, error);
    }
  }
}
