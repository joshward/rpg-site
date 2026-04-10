import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

/**
 * Cron job to send daily notifications.
 * Triggered by Vercel Cron.
 * Security: Uses CRON_SECRET for authentication.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${config.cronSecret}`) {
    console.error('Unauthorized cron access attempt');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  console.log('Cron job /api/cron/notifications started at', new Date().toISOString());

  const { searchParams } = new URL(request.url);
  const dateOverrideParam = searchParams.get('date');
  const dateOverride = dateOverrideParam ? new Date(dateOverrideParam) : undefined;

  const { processNotifications } = await import('@/lib/notifications/service');
  await processNotifications(dateOverride);

  return NextResponse.json({
    success: true,
    message: 'Cron job executed successfully',
    timestamp: new Date().toISOString(),
  });
}
