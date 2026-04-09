import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { guild as guildTable } from '@/db/schema/guild';
import { eq } from 'drizzle-orm';
import { getGuilds, getGuildMembers } from '@/lib/discord/api';
import {
  sendT7Reminder,
  sendT4CoreReminder,
  sendT4OptionalReminder,
  sendT2FinalCall,
  getNotificationContext,
} from '@/lib/notifications';
import { config } from '@/lib/config';
import { getNow } from '@/lib/availability';

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Only available in development', { status: 403 });
  }

  try {
    const { userId, guildId, type, ignoreAllowedRecipients } = await request.json();

    if (!userId || !guildId || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, guildId, type' },
        { status: 400 },
      );
    }

    const [guildData] = await db.select().from(guildTable).where(eq(guildTable.id, guildId));
    if (!guildData) {
      return NextResponse.json({ error: 'Guild not found in database' }, { status: 404 });
    }

    const discordGuilds = await getGuilds();
    const discordGuild = discordGuilds.find((g) => g.id === guildId);
    const guildName = discordGuild?.name || 'Discord Server';

    const members = await getGuildMembers({ guildId });
    const member = members.find((m) => m.user.id === userId);
    const username = member?.user.username || 'Unknown User';

    const now = getNow();
    const context = getNotificationContext(now, guildName, config.siteUrl);

    let success = false;
    const force = !!ignoreAllowedRecipients;

    switch (type) {
      case 'T7':
        success = !!(await sendT7Reminder(userId, username, context, force));
        break;
      case 'T4C':
        success = !!(await sendT4CoreReminder(userId, username, context, force));
        break;
      case 'T4O':
        success = !!(await sendT4OptionalReminder(userId, username, context, force));
        break;
      case 'T2':
        success = !!(await sendT2FinalCall(userId, username, context, force));
        break;
      default:
        return NextResponse.json({ error: `Invalid notification type: ${type}` }, { status: 400 });
    }

    return NextResponse.json({
      success,
      message: success
        ? `Notification ${type} sent to ${username}`
        : `Failed to send notification ${type}`,
    });
  } catch (error) {
    console.error('Error in test-dm endpoint:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
