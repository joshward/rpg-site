import { db } from '@/db/db';
import { guild as guildTable } from '@/db/schema/guild';
import { sendDiscordMessage, getGuilds } from '@/lib/discord/api';
import { getNow, getNextMonth } from '@/lib/availability';
import { config } from '@/lib/config';
import { getDaysUntilEndOfMonth, getPrefix } from './utils';
import {
  getNotificationContext,
  generateT10GlobalMessage,
  generateT3AdminReport,
  generateT2FinalCallGlobal,
  generateT2AdminReport,
  type DiscordMessage,
} from './messages';
import {
  sendT7Reminder,
  sendT4CoreReminder,
  sendT4OptionalReminder,
  sendT2FinalCall,
} from './dm-actions';
import { getPlayerCohorts } from './cohorts';

const NOTIFICATION_DAYS = [10, 7, 4, 3, 2];

async function sendGlobalMessage(channelId: string, message: DiscordMessage, prefix: string) {
  const body = { ...message };
  if (body.content && !body.content.startsWith(prefix)) {
    body.content = `${prefix}${body.content}`;
  } else if (prefix) {
    const inEmbed = body.embeds?.some(
      (e) => e.author?.name?.startsWith(prefix) || e.title?.startsWith(prefix),
    );
    if (!inEmbed) {
      body.content = prefix.trim();
    }
  }
  await sendDiscordMessage({ channelId }, body);
}

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
      const context = getNotificationContext(now, guildName, guildWebappLink, prefix);

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
          await sendGlobalMessage(
            guildData.globalNotificationChannelId,
            generateT10GlobalMessage(context),
            prefix,
          );
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
          const message = generateT3AdminReport({
            corePlayersCount: corePlayers.length,
            missingCoreCount: missingCore.length,
            optionalPlayersCount: optionalPlayers.length,
            missingOptionalCount: missingOptional.length,
          });
          await sendGlobalMessage(guildData.adminNotificationChannelId, message, prefix);
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
          const message = generateT2FinalCallGlobal({ submittedCount, totalActive });
          await sendGlobalMessage(guildData.globalNotificationChannelId, message, prefix);
        }

        if (guildData.adminNotificationChannelId) {
          const message = generateT2AdminReport({
            corePlayersCount: corePlayers.length,
            missingCoreCount: missingCore.length,
            optionalPlayersCount: optionalPlayers.length,
            missingOptionalCount: missingOptional.length,
          });
          await sendGlobalMessage(guildData.adminNotificationChannelId, message, prefix);
        }
      }
    } catch (error) {
      console.error(`Error processing notifications for guild ${guildData.id}:`, error);
    }
  }
}
