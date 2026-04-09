import { createDM, sendDiscordMessage } from '@/lib/discord/api';
import { config } from '@/lib/config';
import { getPrefix } from './utils';

export async function sendDM(
  userId: string,
  username: string,
  content: string,
  label: string,
  force?: boolean,
) {
  const isLocal = process.env.NODE_ENV === 'development';
  const prefix = getPrefix();

  if (isLocal && !force && !config.allowedDmRecipients.includes(userId)) {
    console.log(`${prefix}DM to ${username} (${userId}) blocked: [${label}]`);
    return;
  }

  try {
    const channel = await createDM({ recipient_id: userId });
    await sendDiscordMessage({ channelId: channel.id }, { content: `${prefix}${content}` });
    console.log(`DM sent to ${username} (${userId}): [${label}]`);
    return true;
  } catch (error) {
    console.error(`Failed to send DM to user ${userId}:`, error);
    return false;
  }
}
