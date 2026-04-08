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

  // Logic for notifications will be added here in future tasks.
  // For now, we just log and return success.

  return NextResponse.json({
    success: true,
    message: 'Cron job executed successfully',
    timestamp: new Date().toISOString(),
  });
}
