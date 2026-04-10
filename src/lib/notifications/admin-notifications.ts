import { sendDiscordMessage } from '@/lib/discord/api';
import { db } from '@/db/db';
import { guild as guildTable } from '@/db/schema/guild';
import { eq } from 'drizzle-orm';
import { type DiscordMessage, generateStandardSimpleMessage, applyPrefix } from './messages';
import { getPrefix } from './utils';

export async function notifyAdmin(guildId: string, message: string | DiscordMessage) {
  const [guildData] = await db.select().from(guildTable).where(eq(guildTable.id, guildId));

  if (guildData?.adminNotificationChannelId) {
    const prefix = getPrefix();
    let body: DiscordMessage =
      typeof message === 'string'
        ? generateStandardSimpleMessage(guildId, 'Admin Notification', message, 'info', prefix)
        : { ...message };

    body = applyPrefix(body, prefix);

    try {
      await sendDiscordMessage({ channelId: guildData.adminNotificationChannelId }, body);
    } catch (error) {
      console.error('Failed to send Discord admin notification:', error);
      // We don't rethrow to avoid breaking the user action as per requirements
    }
  }
}
