import { config } from '@/lib/config';

// Membership observations only: this endpoint never invokes notification processing.
export async function GET(request: Request) {
  if (request.headers.get('Authorization') !== `Bearer ${config.cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const { sweepInactivityMemberships } = await import('@/lib/inactivity-tracking');
  const result = await sweepInactivityMemberships();
  return Response.json(
    { success: result.failed === 0, ...result },
    { status: result.failed ? 503 : 200 },
  );
}
