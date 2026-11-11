import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const process = vi.hoisted(() => vi.fn());
vi.mock('@/lib/config', () => ({ config: { cronSecret: 'test-secret' } }));
vi.mock('@/lib/notifications/service', () => ({ processNotifications: process }));
import { GET } from './route';

beforeEach(() => vi.clearAllMocks());
describe('notification job authorization', () => {
  it.each([undefined, 'Bearer wrong'])(
    'rejects unauthorized requests before any job execution (%s)',
    async (authorization) => {
      const response = await GET(
        new NextRequest('http://localhost/api/cron/notifications', {
          headers: authorization ? { Authorization: authorization } : {},
        }),
      );
      expect(response.status).toBe(401);
      expect(process).not.toHaveBeenCalled();
    },
  );
  it('runs the job for the cron secret', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/cron/notifications', {
        headers: { Authorization: 'Bearer test-secret' },
      }),
    );
    expect(response.status).toBe(200);
    expect(process).toHaveBeenCalledOnce();
  });
});
