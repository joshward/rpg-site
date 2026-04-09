import { sendDiscordMessage } from '@/lib/discord/api';
import { db } from '@/db/db';
import { guild as guildTable } from '@/db/schema/guild';
import { eq } from 'drizzle-orm';

export async function notifyAdmin(guildId: string, message: string) {
  const [guildData] = await db.select().from(guildTable).where(eq(guildTable.id, guildId));

  if (guildData?.adminNotificationChannelId) {
    const isLocal = process.env.NODE_ENV === 'development';
    const content = isLocal ? `[LOCAL] ${message}` : message;
    try {
      await sendDiscordMessage({ channelId: guildData.adminNotificationChannelId }, { content });
    } catch (error) {
      console.error('Failed to send Discord admin notification:', error);
      // We don't rethrow to avoid breaking the user action as per requirements
    }
  }
}
