import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  conflict: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock('@/actions/auth-helpers', () => ({
  ensureAdmin: mocks.admin,
  getEffectiveUserContext: vi.fn(),
}));
vi.mock('@/db/db', () => ({ db: { insert: mocks.insert } }));
vi.mock('@/lib/authn', () => ({ fetchUserRole: vi.fn(), fetchUsersGuilds: vi.fn() }));
vi.mock('@/lib/discord/api', () => ({
  getGuildRoles: vi.fn(),
  getGuildChannels: vi.fn(),
  getCurrentUser: vi.fn(),
  getGuildMember: vi.fn(),
  RateLimitError: class extends Error {},
  DiscordApiError: class extends Error {},
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
import { saveGuildConfig } from '../guilds';
const save = (settings?: { enabled: boolean; threshold: number }) =>
  saveGuildConfig(
    'guild-1',
    ['member'],
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    settings,
  );
beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue({});
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.values.mockReturnValue({ onConflictDoUpdate: mocks.conflict });
});
describe('main guild form inactivity settings', () => {
  it('saves enablement and threshold with all other settings in the same guild upsert', async () => {
    expect((await save({ enabled: true, threshold: 5 })).type).toBe('success');
    expect(mocks.admin).toHaveBeenCalledWith('guild-1');
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'guild-1',
        allowedRoles: ['member'],
        inactivityEnabled: true,
        inactivityThreshold: 5,
      }),
    );
    expect(mocks.conflict.mock.calls[0][0].set).toMatchObject({
      inactivityEnabled: true,
      inactivityThreshold: 5,
    });
    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.revalidate).toHaveBeenCalledWith('/g/guild-1/admin');
  });
  it('can disable immediately without discarding the saved threshold', async () => {
    expect((await save({ enabled: false, threshold: 5 })).type).toBe('success');
    expect(mocks.conflict.mock.calls[0][0].set).toMatchObject({
      inactivityEnabled: false,
      inactivityThreshold: 5,
    });
  });
  it('preserves settings when an older caller omits the new optional argument', async () => {
    await save();
    expect(mocks.conflict.mock.calls[0][0].set).not.toHaveProperty('inactivityEnabled');
    expect(mocks.conflict.mock.calls[0][0].set).not.toHaveProperty('inactivityThreshold');
  });
  it.each([
    null,
    { enabled: 'true', threshold: 3 },
    { enabled: true, threshold: 1 },
    { enabled: false, threshold: 13 },
  ])('rejects malformed configuration before writing %j', async (settings) => {
    expect((await save(settings as never)).type).toBe('failure');
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('rejects non-admins before any config write', async () => {
    mocks.admin.mockRejectedValue(new Error('Forbidden'));
    expect((await save({ enabled: true, threshold: 3 })).type).toBe('failure');
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
