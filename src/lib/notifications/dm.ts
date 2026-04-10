import { createDM, sendDiscordMessage } from '@/lib/discord/api';
import { config } from '@/lib/config';
import { getPrefix } from './utils';
import { type DiscordMessage } from './messages';
import { MessageFlags, ComponentType } from '@/lib/discord/models';

export async function sendDM(
  userId: string,
  username: string,
  message: string | DiscordMessage,
  label: string,
  force?: boolean,
) {
  const isLocal = process.env.NODE_ENV === 'development';
  const prefix = getPrefix();

  if (isLocal && !force && !config.allowedDmRecipients.includes(userId)) {
    console.log(`${prefix}DM to ${username} (${userId}) blocked: [${label}]`);
    return;
  }

  const body: DiscordMessage = typeof message === 'string' ? { content: message } : { ...message };

  const isV2 = !!(body.flags && body.flags & MessageFlags.IS_COMPONENTS_V2);

  // Only add prefix to content if it's a plain text message or if we specifically want it there.
  // Standardized DM embeds now handle the prefix themselves.
  if (isV2) {
    // For V2 messages, we assume the generator (generateStandardDM) already handled the prefix.
    // However, if we don't have any prefix in the message, we can't easily add it to components here
    // without knowing the structure. So we rely on the caller/generator to handle it.
  } else if (body.content && !body.content.startsWith(prefix)) {
    body.content = `${prefix}${body.content}`;
  } else if (prefix) {
    const inEmbedOrComponents =
      body.embeds?.some((e) => e.author?.name?.startsWith(prefix) || e.title?.startsWith(prefix)) ||
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
    const channel = await createDM({ recipient_id: userId });
    await sendDiscordMessage({ channelId: channel.id }, body);
    console.log(`DM sent to ${username} (${userId}): [${label}]`);
    return true;
  } catch (error) {
    console.error(`Failed to send DM to user ${userId}:`, error);
    return false;
  }
}
