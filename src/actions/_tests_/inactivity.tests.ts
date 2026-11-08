import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { getTableName } from 'drizzle-orm';

const mocks = vi.hoisted(() => ({
  ensureAdmin: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  sync: vi.fn(),
}));
vi.mock('@/actions/auth-helpers', () => ({ ensureAdmin: mocks.ensureAdmin }));
vi.mock('@/db/db', () => ({ db: { select: mocks.select, update: mocks.update } }));
vi.mock('@/lib/inactivity-tracking', () => ({ syncGuildInactivityTracking: mocks.sync }));
vi.mock('@/lib/discord/api', () => ({
  RateLimitError: class extends Error {},
  DiscordApiError: class extends Error {},
}));
import { getInactivityPreview } from '../inactivity';

const conditions: string[] = [];
const initializedAt = new Date('2026-04-01Z');
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NOW_OVERRIDE', '');
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-26T00:00:00Z'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  conditions.length = 0;
  mocks.ensureAdmin.mockResolvedValue({
    guildData: { allowedRoles: ['member'], inactivityEnabled: true, inactivityThreshold: 3 },
  });
  mocks.sync.mockResolvedValue({
    state: { initializedAt, scheduleFallbackAt: new Date('2025-01-01Z') },
    tracked: [
      {
        guildId: 'guild-a',
        discordUserId: 'human',
        firstEligibleAt: new Date('2025-01-01Z'),
        additionSource: 'schedule_fallback',
        firstObservedAt: initializedAt,
        lastObservedAt: new Date('2026-04-26Z'),
        hasAccess: true,
        accessSince: new Date('2025-01-01Z'),
        discordJoinedAt: '2025-01-01Z',
      },
    ],
    members: [
      { user: { id: 'human', username: 'Human' }, roles: ['member'], joined_at: '2025-01-01Z' },
    ],
    observations: [{ discordUserId: 'human', eligible: true }],
  });
  mocks.select.mockReturnValue({
    from: (table: Parameters<typeof getTableName>[0]) => ({
      where: (condition: Parameters<PgDialect['sqlToQuery']>[0]) => {
        conditions.push(JSON.stringify(new PgDialect().sqlToQuery(condition)));
        return Promise.resolve(
          getTableName(table) === 'member_preferences'
            ? [{ discordUserId: 'human', sessionsPerMonth: 2 }]
            : [],
        );
      },
    }),
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('admin inactivity preview boundaries', () => {
  it('authorizes every read and write before DB/census access', async () => {
    mocks.ensureAdmin.mockRejectedValue(new Error('Forbidden'));
    expect((await getInactivityPreview('guild-b')).type).toBe('failure');
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('scopes preview reads and membership tracking to the authorized guild', async () => {
    const result = await getInactivityPreview('guild-a');
    if (result.type !== 'success') throw new Error('Expected preview');
    expect(result.data.members[0]).toMatchObject({ classification: 'inactive', wouldPause: true });
    expect(mocks.sync).toHaveBeenCalledWith('guild-a', ['member']);
    expect(conditions).toHaveLength(2);
    for (const condition of conditions) expect(condition).toContain('guild-a');
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('lists only current eligible humans, retaining allowed-role players and guild admins', async () => {
    mocks.sync.mockResolvedValueOnce({
      state: { initializedAt, scheduleFallbackAt: null },
      tracked: [{ guildId: 'guild-a', discordUserId: 'departed' }],
      members: [
        { user: { id: 'human', username: 'Allowed Player' }, roles: ['member'] },
        { user: { id: 'admin', username: 'Admin' }, roles: ['administrator'] },
        { user: { id: 'outsider', username: 'No Access' }, roles: ['unrelated'] },
        { user: { id: 'bot', username: 'Bot', bot: true }, roles: ['member'] },
      ],
      observations: [
        { discordUserId: 'human', eligible: true },
        { discordUserId: 'admin', eligible: true },
        { discordUserId: 'outsider', eligible: false },
        { discordUserId: 'bot', eligible: true },
      ],
    });
    mocks.select.mockReturnValue({
      from: (table: Parameters<typeof getTableName>[0]) => ({
        where: async () =>
          getTableName(table) === 'member_preferences'
            ? [
                { discordUserId: 'human', sessionsPerMonth: 0 },
                { discordUserId: 'outsider', sessionsPerMonth: 2 },
                { discordUserId: 'departed', sessionsPerMonth: 2 },
              ]
            : [],
      }),
    });
    const result = await getInactivityPreview('guild-a');
    if (result.type !== 'success') throw new Error('Expected preview');
    expect(result.data.members.map((m) => m.discordUserId).sort()).toEqual(['admin', 'human']);
    // Zero and missing preferences remain visible as Not participating; lack of
    // role access must not be confused with this participation choice.
    expect(result.data.members.every((m) => m.classification === 'excluded')).toBe(true);
    expect(result.data.members.find((m) => m.discordUserId === 'human')?.reasons).toContain(
      'Already zero',
    );
    expect(result.data.members.find((m) => m.discordUserId === 'admin')?.reasons).toContain(
      'Desired sessions not configured',
    );
  });
  it.each([
    ['2026-05-26T23:59:59.999Z', false],
    ['2026-05-27', true],
  ])('uses NOW_OVERRIDE %s for evaluation but not census dates', async (date, atCutoff) => {
    vi.stubEnv('NOW_OVERRIDE', date);
    const result = await getInactivityPreview('guild-a');
    if (result.type !== 'success') throw new Error('Expected preview');
    expect(result.data.evaluatedAt).toBe(new Date(date).toISOString());
    expect(result.data.dateOverridden).toBe(true);
    expect(result.data.members[0]).toMatchObject({
      target: '2026-06',
      cutoff: '2026-05-27T00:00:00.000Z',
      atCutoff,
    });
    expect(result.data.members[0].months.map((m) => m.month)).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
    ]);
    expect(mocks.sync).toHaveBeenCalledWith('guild-a', ['member']);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('fails closed on incomplete/failed membership census', async () => {
    mocks.sync.mockRejectedValue(new Error('Discord unavailable'));
    expect((await getInactivityPreview('guild-a')).type).toBe('failure');
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('does not initialize tracking for an unconfigured guild', async () => {
    mocks.ensureAdmin.mockResolvedValue({ guildData: undefined });
    expect((await getInactivityPreview('guild-a')).type).toBe('failure');
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it('blocks disabled preview reads before any census or availability query', async () => {
    mocks.ensureAdmin.mockResolvedValue({
      guildData: { allowedRoles: ['member'], inactivityEnabled: false },
    });
    expect((await getInactivityPreview('guild-a')).type).toBe('failure');
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });
});
