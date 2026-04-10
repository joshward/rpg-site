import { sendDiscordMessage } from '@/lib/discord/api';
import {
  type DiscordMessage,
  type NotificationContext,
  generateT10GlobalMessage,
  generateT3AdminReport,
  generateT2FinalCallGlobal,
  generateT2AdminReport,
  applyPrefix,
} from './messages';
import { getPrefix } from './utils';

export async function sendGlobalMessage(channelId: string, message: DiscordMessage, label: string) {
  const prefix = getPrefix();
  let body = { ...message };

  body = applyPrefix(body, prefix);

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
