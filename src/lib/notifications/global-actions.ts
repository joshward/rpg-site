import { sendDiscordMessage } from '@/lib/discord/api';
import {
  type DiscordMessage,
  type NotificationContext,
  generateT10GlobalMessage,
  generateT3AdminReport,
  generateT2FinalCallGlobal,
  generateT2AdminReport,
} from './messages';
import { getPrefix } from './utils';
import { MessageFlags, ComponentType } from '@/lib/discord/models';

export async function sendGlobalMessage(channelId: string, message: DiscordMessage, label: string) {
  const prefix = getPrefix();
  const body = { ...message };

  const isV2 = !!(body.flags && body.flags & MessageFlags.IS_COMPONENTS_V2);

  if (isV2) {
    // For V2 messages, we assume the generator (generateStandardDM) already handled the prefix.
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
    await sendDiscordMessage({ channelId }, body);
    console.log(`Global message sent to channel ${channelId}: [${label}]`);
    return true;
  } catch (error) {
    console.error(`Failed to send global message to channel ${channelId}:`, error);
    return false;
  }
}

export async function sendT10Global(channelId: string, context: NotificationContext) {
  const message = generateT10GlobalMessage(context);
  return sendGlobalMessage(channelId, message, 'T-10 Global');
}

export async function sendT3AdminReportAction(
  channelId: string,
  context: NotificationContext,
  data: {
    corePlayersCount: number;
    missingCoreCount: number;
    optionalPlayersCount: number;
    missingOptionalCount: number;
  },
) {
  const message = generateT3AdminReport(context, data);
  return sendGlobalMessage(channelId, message, 'T-3 Admin Report');
}

export async function sendT2FinalCallGlobalAction(
  channelId: string,
  context: NotificationContext,
  data: {
    submittedCount: number;
    totalActive: number;
  },
) {
  const message = generateT2FinalCallGlobal(context, data);
  return sendGlobalMessage(channelId, message, 'T-2 Final Call Global');
}

export async function sendT2AdminReportAction(
  channelId: string,
  context: NotificationContext,
  data: {
    corePlayersCount: number;
    missingCoreCount: number;
    optionalPlayersCount: number;
    missingOptionalCount: number;
  },
) {
  const message = generateT2AdminReport(context, data);
  return sendGlobalMessage(channelId, message, 'T-2 Admin Report');
}
