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

type Row = Record<string, unknown>;
const data = new Map<string, Row[]>();
const reads: { table: string; params: unknown[] }[] = [];
const writes: { table: string; value: Row | Row[] }[] = [];
const upserts: { target: unknown[]; set: Row }[] = [];
const locks = vi.fn();
const member = {
  user: { id: 'never-logged-in', username: 'Player', bot: false },
  roles: ['member'],
  joined_at: '2025-01-01Z',
};
const roles = [{ id: 'member', name: 'Member', permissions: '0' }];

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-26Z'));
  vi.stubEnv('NOW_OVERRIDE', '2030-01-01');
  data.clear();
  reads.length = 0;
  writes.length = 0;
  upserts.length = 0;
  data.set('guilds', [{ id: 'a', allowedRoles: ['member'] }]);
  data.set('scheduled_sessions', [{ at: '2025-01-15T00:00:00Z' }]);
  mocks.members.mockResolvedValue([member]);
  mocks.roles.mockResolvedValue(roles);
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
    values: (value: Row | Row[]) => {
      const name = getTableName(table);
      if (!Array.isArray(value)) {
        writes.push({ table: name, value });
        data.set(name, [...(data.get(name) ?? []), value]);
        return Promise.resolve();
      }
      return {
        onConflictDoUpdate: async (options: { target: unknown[]; set: Row }) => {
          upserts.push(options);
          writes.push({ table: name, value });
          const rows = [...(data.get(name) ?? [])];
          for (const row of value) {
            const index = rows.findIndex(
              (old) => old.guildId === row.guildId && old.discordUserId === row.discordUserId,
            );
            if (index < 0) rows.push(row);
            else
              rows[index] = {
                ...rows[index],
                hasAccess: row.hasAccess,
                lastObservedAt: row.lastObservedAt,
                accessSince: row.accessSince,
                discordJoinedAt: row.discordJoinedAt,
              };
          }
          data.set(name, rows);
        },
      };
    },
  }));
  mocks.update.mockImplementation((table: Parameters<typeof getTableName>[0]) => ({
    set: (value: Row) => ({
      where: async (condition: Parameters<PgDialect['sqlToQuery']>[0]) => {
        const name = getTableName(table);
        writes.push({ table: name, value });
        expect(new PgDialect().sqlToQuery(condition).params).toContain('a');
        data.set(
          name,
          (data.get(name) ?? []).map((old) => ({ ...old, ...value })),
        );
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
  it('initializes one census without login and ignores testing clock for observations', async () => {
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
  it('captures ordering before API calls but actual observation dates after they finish', async () => {
    mocks.members.mockImplementationOnce(async () => {
      vi.setSystemTime(new Date('2026-04-26T00:01:00Z'));
      return [member];
    });
    const result = await syncGuildInactivityTracking('a', ['member']);
    expect(result.state.lastCensusStartedAt).toEqual(new Date('2026-04-26T00:00:00Z'));
    expect(result.tracked[0].firstObservedAt).toEqual(new Date('2026-04-26T00:01:00Z'));
  });
  it('initialization is persisted so later members cannot inherit the fallback and updates omit immutable fields', async () => {
    await syncGuildInactivityTracking('a', ['member']);
    vi.setSystemTime(new Date('2026-04-26T00:00:01Z'));
    mocks.members.mockResolvedValue([member, { ...member, user: { ...member.user, id: 'new' } }]);
    const result = await syncGuildInactivityTracking('a', ['member']);
    expect(result.tracked.find((m) => m.discordUserId === 'new')).toMatchObject({
      additionSource: 'first_observed',
      firstEligibleAt: new Date('2026-04-26T00:00:01Z'),
    });
    expect(upserts.at(-1)?.target).toHaveLength(2);
    expect(Object.keys(upserts.at(-1)!.set).sort()).toEqual([
      'accessSince',
      'discordJoinedAt',
      'hasAccess',
      'lastObservedAt',
    ]);
    expect(data.get('inactivity_member_tracking')?.[0].firstEligibleAt).toEqual(
      new Date('2025-01-15Z'),
    );
    expect(data.get('inactivity_guild_tracking')).toHaveLength(1);
  });
  it('does not commit any tracking if membership or role requests fail', async () => {
    mocks.members.mockRejectedValue(new Error('API unavailable'));
    await expect(syncGuildInactivityTracking('a', ['member'])).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
    mocks.members.mockResolvedValue([member]);
    mocks.roles.mockRejectedValue(new Error('Roles unavailable'));
    await expect(syncGuildInactivityTracking('a', ['member'])).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('fully paginates and writes 1001 members in five bounded upserts rather than per-member round trips', async () => {
    const page = Array.from({ length: 1000 }, (_, i) => ({
      ...member,
      user: { ...member.user, id: String(i) },
    }));
    mocks.members.mockResolvedValueOnce(page).mockResolvedValueOnce([member]);
    const result = await syncGuildInactivityTracking('a', ['member']);
    expect(result.tracked).toHaveLength(1001);
    expect(mocks.members).toHaveBeenNthCalledWith(2, { guildId: 'a', after: '999' });
    const batches = writes.filter((w) => w.table === 'inactivity_member_tracking');
    expect(batches).toHaveLength(5);
    expect(batches.map((batch) => (batch.value as Row[]).length)).toEqual([250, 250, 250, 250, 1]);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    'rejects a slow stale census after a newer departure/empty census (existing player: %s)',
    async (existingPlayer) => {
      if (!existingPlayer) mocks.members.mockResolvedValueOnce([]);
      await syncGuildInactivityTracking('a', ['member']);
      vi.setSystemTime(new Date('2026-04-26T00:00:01Z'));
      let release!: (value: typeof roles) => void;
      let entered!: () => void;
      const blocked = new Promise<typeof roles>((resolve) => {
        release = resolve;
      });
      const enteredRoles = new Promise<void>((resolve) => {
        entered = resolve;
      });
      mocks.roles.mockImplementationOnce(() => {
        entered();
        return blocked;
      });
      const older = syncGuildInactivityTracking('a', ['member']).then(
        () => null,
        (error: unknown) => error,
      );
      await enteredRoles;
      vi.setSystemTime(new Date('2026-04-26T00:00:02Z'));
      mocks.members.mockResolvedValueOnce([]);
      await syncGuildInactivityTracking('a', ['member']);
      const count = writes.length;
      vi.setSystemTime(new Date('2026-04-26T00:00:03Z'));
      release(roles);
      expect(await older).toEqual(
        expect.objectContaining({ message: 'A newer membership census already committed; retry' }),
      );
      expect(writes).toHaveLength(count);
      expect(data.get('inactivity_member_tracking')?.some((row) => row.hasAccess)).toBeFalsy();
    },
  );
  it('rejects non-advancing pages before opening a transaction', async () => {
    mocks.members.mockResolvedValue(Array.from({ length: 1000 }, () => member));
    await expect(syncGuildInactivityTracking('a', ['member'])).rejects.toThrow('pagination');
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('rejects changed access configuration under the lock', async () => {
    await expect(syncGuildInactivityTracking('a', ['other-role'])).rejects.toThrow(
      'configuration changed',
    );
    expect(writes).toEqual([]);
  });
  it('does not enroll bots or no-access members', async () => {
    mocks.members.mockResolvedValue([{ ...member, user: { ...member.user, bot: true } }]);
    expect((await syncGuildInactivityTracking('a', ['member'])).tracked).toEqual([]);
    expect(mocks.role).not.toHaveBeenCalled();
  });
  it('isolates failed guilds in daily sweeps', async () => {
    mocks.members.mockRejectedValue(new Error('Discord unavailable'));
    expect(await sweepInactivityMemberships()).toEqual({ succeeded: 0, failed: 1 });
    expect(writes).toEqual([]);
  });
});
