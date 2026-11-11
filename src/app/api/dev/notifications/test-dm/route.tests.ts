import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateInactivityPauseMessage } from '@/lib/notifications/inactivity-message';
import { applyPrefix } from '@/lib/notifications/messages';

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  guilds: vi.fn(),
  members: vi.fn(),
  createDM: vi.fn(),
  send: vi.fn(),
  t7: vi.fn(),
  t4c: vi.fn(),
  t4o: vi.fn(),
  t2: vi.fn(),
  allowed: ['tester'],
}));
vi.mock('@/db/db', () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
    update: mocks.update,
    transaction: mocks.transaction,
  },
}));
vi.mock('@/lib/config', () => ({
  config: { siteUrl: 'http://localhost:3000', allowedDmRecipients: mocks.allowed },
}));
vi.mock('@/lib/discord/api', () => ({
  getGuilds: mocks.guilds,
  getGuildMembers: mocks.members,
  createDM: mocks.createDM,
  sendDiscordMessage: mocks.send,
}));
vi.mock('@/lib/availability', () => ({ getNow: () => new Date('2028-12-15T12:00:00Z') }));
vi.mock('@/lib/notifications', async () => ({
  sendT7Reminder: mocks.t7,
  sendT4CoreReminder: mocks.t4c,
  sendT4OptionalReminder: mocks.t4o,
  sendT2FinalCall: mocks.t2,
  getPrefix: () => '[Test Message] ',
  getNotificationContext: () => ({ target: { year: 2029, month: 1 } }),
  ...(await import('@/lib/notifications/inactivity-message')),
  ...(await import('@/lib/notifications/dm')),
}));
import { POST } from './route';

const request = (type = 'INACTIVITY', extra = {}) =>
  new Request('http://localhost/api/dev/notifications/test-dm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'tester', guildId: 'guild', type, ...extra }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('INACTIVITY_AUTOMATION_ENABLED', 'false');
  mocks.select.mockReturnValue({
    from: () => ({
      where: async () => [{ id: 'guild', inactivityThreshold: 3, inactivityEnabled: false }],
    }),
  });
  mocks.guilds.mockResolvedValue([{ id: 'guild', name: 'Test Guild' }]);
  mocks.members.mockResolvedValue([{ user: { id: 'tester', username: 'Tester' } }]);
  mocks.createDM.mockResolvedValue({ id: 'dm-channel' });
  mocks.send.mockResolvedValue({});
  mocks.t7.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());

describe('isolated inactivity explanation preview', () => {
  it('sends shared production wording with a clear no-mutation disclaimer and synthetic response cycles', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true });
    const previewMessage = generateInactivityPauseMessage({
      guildId: 'guild',
      guildName: 'Test Guild',
      checkedMonths: ['2028-11', '2028-12', '2029-01'],
      availabilityUrl: 'http://localhost:3000/g/guild/availability?year=2029&month=1',
      preview: true,
    });
    expect(mocks.send).toHaveBeenCalledWith(
      { channelId: 'dm-channel' },
      applyPrefix(previewMessage, '[Test Message] '),
    );
    expect(JSON.stringify(mocks.send.mock.calls[0][1])).toContain(
      'TEST PREVIEW ONLY — no preferences were changed.',
    );
    expect(mocks.select).toHaveBeenCalledOnce(); // Guild configuration only; no player history.
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('respects the development recipient allowlist', async () => {
    const response = await POST(request('INACTIVITY', { userId: 'not-allowed' }));
    expect(await response.json()).toMatchObject({ success: false });
    expect(mocks.createDM).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('retains the existing explicit force override', async () => {
    const response = await POST(
      request('INACTIVITY', { userId: 'not-allowed', ignoreAllowedRecipients: true }),
    );
    expect(await response.json()).toMatchObject({ success: true });
    expect(mocks.createDM).toHaveBeenCalledWith({ recipient_id: 'not-allowed' });
  });
  it.each(['production', 'test'])(
    'is unavailable outside development (%s)',
    async (environment) => {
      vi.stubEnv('NODE_ENV', environment);
      expect((await POST(request())).status).toBe(403);
      expect(mocks.select).not.toHaveBeenCalled();
      expect(mocks.send).not.toHaveBeenCalled();
    },
  );
  it('reports DM rejection without changing preferences', async () => {
    mocks.send.mockRejectedValueOnce(new Error('Rejected'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await POST(request());
    expect(await response.json()).toMatchObject({ success: false });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it('preserves ordinary reminder testing', async () => {
    expect((await POST(request('T7'))).status).toBe(200);
    expect(mocks.t7).toHaveBeenCalledWith('tester', 'Tester', expect.anything(), false);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('rejects unsupported notification types', async () => {
    expect((await POST(request('INVALID'))).status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
