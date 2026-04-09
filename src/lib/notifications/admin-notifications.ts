import { sendDiscordMessage } from '@/lib/discord/api';
import { db } from '@/db/db';
import { guild as guildTable } from '@/db/schema/guild';
import { eq } from 'drizzle-orm';
import { type DiscordMessage } from './messages';
import { getPrefix } from './utils';
import { MessageFlags, ComponentType } from '@/lib/discord/models';

export async function notifyAdmin(guildId: string, message: string | DiscordMessage) {
  const [guildData] = await db.select().from(guildTable).where(eq(guildTable.id, guildId));

  if (guildData?.adminNotificationChannelId) {
    const prefix = getPrefix();
    const body: DiscordMessage =
      typeof message === 'string' ? { content: message } : { ...message };

    const isV2 = !!(body.flags && body.flags & MessageFlags.IS_COMPONENTS_V2);

    if (isV2) {
      // For V2 messages, assume the generator handled the prefix.
    } else if (body.content && !body.content.startsWith(prefix)) {
      body.content = `${prefix}${body.content}`;
    } else if (prefix) {
      const inEmbedOrComponents =
        body.embeds?.some(
          (e) => e.author?.name?.startsWith(prefix) || e.title?.startsWith(prefix),
        ) ||
        body.components?.some((c) => {
          if (c.type === ComponentType.TEXT_DISPLAY && c.content.startsWith(prefix)) return true;
          return (
            c.type === ComponentType.CONTAINER &&
            c.components?.some(
              (cc: any) => cc.type === ComponentType.TEXT_DISPLAY && cc.content.startsWith(prefix),
            )
          );
        });

      if (!inEmbedOrComponents) {
        body.content = prefix.trim();
      }
    }

    try {
      await sendDiscordMessage({ channelId: guildData.adminNotificationChannelId }, body);
    } catch (error) {
      console.error('Failed to send Discord admin notification:', error);
      // We don't rethrow to avoid breaking the user action as per requirements
    }
  }
}
