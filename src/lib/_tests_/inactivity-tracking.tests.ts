import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  transaction: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  members: vi.fn(),
  roles: vi.fn(),
  role: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/db/db', () => ({ db: { select: mocks.select, transaction: mocks.transaction } }));
vi.mock('@/lib/discord/api', () => ({
  getGuildMembers: mocks.members,
  getGuildRoles: mocks.roles,
}));
vi.mock('@/lib/authn', () => ({ resolveRoleWithGuildRoles: mocks.role }));
import { syncGuildInactivityTracking, sweepInactivityMemberships } from '../inactivity-tracking';

const data = new Map<string, object[]>();
const reads: { table: string; params: unknown[] }[] = [];
const writes: { table: string; value: object }[] = [];
const locks = vi.fn();
const member = {
  user: { id: 'never-logged-in', username: 'Player', bot: false },
  roles: ['member'],
  joined_at: '2025-01-01Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-26Z'));
  vi.stubEnv('NOW_OVERRIDE', '2030-01-01');
  data.clear();
  reads.length = 0;
  writes.length = 0;
  data.set('guilds', [{ id: 'a', allowedRoles: ['member'] }]);
  data.set('scheduled_sessions', [{ at: '2025-01-15T00:00:00Z' }]);
  mocks.members.mockResolvedValue([member]);
  mocks.roles.mockResolvedValue([{ id: 'member', name: 'Member', permissions: '0' }]);
  mocks.role.mockReturnValue('member');
  mocks.select.mockReturnValue({
    from: (table: Parameters<typeof getTableName>[0]) => {
      const name = getTableName(table);
      const rows = () => data.get(name) ?? [];
      return Object.assign(Promise.resolve(rows()), {
        where: (condition: Parameters<PgDialect['sqlToQuery']>[0]) => {
          reads.push({ table: name, params: new PgDialect().sqlToQuery(condition).params });
          return Object.assign(Promise.resolve(rows()), {
            for: (mode: string) => {
              locks(name, mode);
              return Promise.resolve(rows());
            },
          });
        },
      });
    },
  });
  mocks.insert.mockImplementation((table: Parameters<typeof getTableName>[0]) => ({
    values: async (value: object) => {
      const name = getTableName(table);
      writes.push({ table: name, value });
      data.set(name, [...(data.get(name) ?? []), value]);
    },
  }));
  mocks.update.mockImplementation((table: Parameters<typeof getTableName>[0]) => ({
    set: (value: object) => ({
      where: async (condition: Parameters<PgDialect['sqlToQuery']>[0]) => {
        writes.push({ table: getTableName(table), value });
        expect(new PgDialect().sqlToQuery(condition).params).toContain('a');
      },
    }),
  }));
  mocks.transaction.mockImplementation(async (callback) =>
    callback({ select: mocks.select, insert: mocks.insert, update: mocks.update }),
  );
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('guild-scoped automatic membership persistence', () => {
  it('initializes one census and enrolls members without app login; override never changes observation timestamps', async () => {
    const result = await syncGuildInactivityTracking('a', ['member']);
    expect(result.state.initializedAt).toEqual(new Date('2026-04-26Z'));
    expect(result.tracked[0]).toMatchObject({
      additionSource: 'schedule_fallback',
      firstEligibleAt: new Date('2025-01-15Z'),
    });
    expect(locks).toHaveBeenCalledWith('guilds', 'update');
    for (const read of reads) expect(read.params).toContain('a');
    expect(writes.every((w) => w.table.startsWith('inactivity_'))).toBe(true);
  });
  it('initialization is persisted so later members cannot inherit the old fallback', async () => {
    await syncGuildInactivityTracking('a', ['member']);
    mocks.members.mockResolvedValue([member, { ...member, user: { ...member.user, id: 'new' } }]);
    const result = await syncGuildInactivityTracking('a', ['member']);
    expect(result.tracked.find((m) => m.discordUserId === 'new')).toMatchObject({
      additionSource: 'first_observed',
      firstEligibleAt: new Date('2026-04-26Z'),
    });
    expect(writes.filter((w) => w.table === 'inactivity_guild_tracking')).toHaveLength(1);
    expect(
      writes.filter((w) => w.table === 'inactivity_member_tracking').at(-2)?.value,
    ).not.toHaveProperty('firstEligibleAt');
  });
  it('never commits any tracking if Discord membership or role lookup fails', async () => {
    mocks.members.mockRejectedValue(new Error('API unavailable'));
    await expect(syncGuildInactivityTracking('a', ['member'])).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
    mocks.members.mockResolvedValue([member]);
    mocks.roles.mockRejectedValue(new Error('Roles unavailable'));
    await expect(syncGuildInactivityTracking('a', ['member'])).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('paginates completely before committing a baseline', async () => {
    const page = Array.from({ length: 1000 }, (_, i) => ({
      ...member,
      user: { ...member.user, id: String(i) },
    }));
    mocks.members.mockResolvedValueOnce(page).mockResolvedValueOnce([]);
    const result = await syncGuildInactivityTracking('a', ['member']);
    expect(result.tracked).toHaveLength(1000);
    expect(mocks.members).toHaveBeenNthCalledWith(2, { guildId: 'a', after: '999' });
  });
  it('rejects a non-advancing page without a partial census', async () => {
    const page = Array.from({ length: 1000 }, () => member);
    mocks.members.mockResolvedValue(page);
    await expect(syncGuildInactivityTracking('a', ['member'])).rejects.toThrow('pagination');
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('rejects changed access configuration under the guild lock', async () => {
    await expect(syncGuildInactivityTracking('a', ['other-role'])).rejects.toThrow(
      'configuration changed',
    );
    expect(writes).toEqual([]);
  });
  it('does not enroll bots or no-access members into the rollout cohort', async () => {
    mocks.members.mockResolvedValue([{ ...member, user: { ...member.user, bot: true } }]);
    expect((await syncGuildInactivityTracking('a', ['member'])).tracked).toEqual([]);
    expect(mocks.role).not.toHaveBeenCalled();
  });
  it('daily sweeps isolate failed guilds and never invoke notification services', async () => {
    mocks.members.mockRejectedValue(new Error('Discord unavailable'));
    expect(await sweepInactivityMemberships()).toEqual({ succeeded: 0, failed: 1 });
    expect(writes).toEqual([]);
  });
});
