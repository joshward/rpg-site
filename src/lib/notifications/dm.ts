import { createDM, sendDiscordMessage } from '@/lib/discord/api';
import { config } from '@/lib/config';
import { getPrefix } from './utils';
import { type DiscordMessage, applyPrefix } from './messages';

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

  let body: DiscordMessage = typeof message === 'string' ? { content: message } : { ...message };

  body = applyPrefix(body, prefix);

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
