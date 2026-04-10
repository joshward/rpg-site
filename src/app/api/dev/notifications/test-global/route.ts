import { NextResponse } from 'next/server';
import { getGuilds } from '@/lib/discord/api';
import {
  sendT10Global,
  sendT3AdminReportAction,
  sendT2FinalCallGlobalAction,
  sendT2AdminReportAction,
  getNotificationContext,
  getPrefix,
} from '@/lib/notifications';
import { config } from '@/lib/config';
import { getNow } from '@/lib/availability';

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Only available in development', { status: 403 });
  }

  try {
    const { channelId, guildId, type } = await request.json();

    if (!channelId || !guildId || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: channelId, guildId, type' },
        { status: 400 },
      );
    }

    const discordGuilds = await getGuilds();
    const discordGuild = discordGuilds.find((g) => g.id === guildId);
    const guildName = discordGuild?.name || 'Discord Server';

    const now = getNow();
    const prefix = getPrefix();
    const guildWebappLink = `${config.siteUrl}/g/${guildId}/availability`;
    const context = getNotificationContext(now, guildId, guildName, guildWebappLink, prefix);

    let success = false;

    // Test data for reports
    const testData = {
      corePlayersCount: 10,
      missingCoreCount: 3,
      optionalPlayersCount: 5,
      missingOptionalCount: 2,
    };

    const testFinalCallData = {
      submittedCount: 10,
      totalActive: 15,
    };

    switch (type) {
      case 'T10':
        success = await sendT10Global(channelId, context);
        break;
      case 'T3':
        success = await sendT3AdminReportAction(channelId, context, testData);
        break;
      case 'T2G':
        success = await sendT2FinalCallGlobalAction(channelId, context, testFinalCallData);
        break;
      case 'T2A':
        success = await sendT2AdminReportAction(channelId, context, testData);
        break;
      default:
        return NextResponse.json({ error: `Invalid notification type: ${type}` }, { status: 400 });
    }

    return NextResponse.json({
      success,
      message: success
        ? `Global notification ${type} sent to channel ${channelId}`
        : `Failed to send global notification ${type}`,
    });
  } catch (error) {
    console.error('Error in test-global endpoint:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
