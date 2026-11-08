import { beforeEach, describe, expect, it, vi } from 'vitest';
const sweep = vi.hoisted(() => vi.fn());
vi.mock('@/lib/config', () => ({ config: { cronSecret: 'test-secret' } }));
vi.mock('@/lib/inactivity-tracking', () => ({ sweepInactivityMemberships: sweep }));
import { GET } from './route';
beforeEach(() => {
  vi.resetAllMocks();
  sweep.mockResolvedValue({ succeeded: 1, failed: 0 });
});
describe('membership-only daily cron', () => {
  it('rejects unauthorized calls before any census access', async () => {
    expect((await GET(new Request('http://localhost/api/cron/inactivity-tracking'))).status).toBe(
      401,
    );
    expect(sweep).not.toHaveBeenCalled();
  });
  it('runs membership tracking with authentication and ignores date-override query parameters', async () => {
    const response = await GET(
      new Request('http://localhost/api/cron/inactivity-tracking?date=2030-01-01', {
        headers: { Authorization: 'Bearer test-secret' },
      }),
    );
    expect(response.status).toBe(200);
    expect(sweep).toHaveBeenCalledWith();
    expect(await response.json()).toEqual({ success: true, succeeded: 1, failed: 0 });
  });
  it('reports failed guilds for retry without exposing member data', async () => {
    sweep.mockResolvedValue({ succeeded: 0, failed: 1 });
    const response = await GET(
      new Request('http://localhost/api/cron/inactivity-tracking', {
        headers: { Authorization: 'Bearer test-secret' },
      }),
    );
    expect(response.status).toBe(503);
  });
});
