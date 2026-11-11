import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTableName } from 'drizzle-orm';

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  admin: vi.fn(),
  select: vi.fn(),
  preview: vi.fn(),
  members: vi.fn(),
  role: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/actions/auth-helpers', () => ({ ensureAdmin: mocks.admin, ensureAccess: mocks.access }));
vi.mock('@/db/db', () => ({ db: { select: mocks.select } }));
vi.mock('@/actions/inactivity', () => ({ getInactivityPreview: mocks.preview }));
vi.mock('@/lib/discord/api', () => ({
  getGuildMembers: mocks.members,
  getGuildMember: vi.fn(),
  RateLimitError: class extends Error {},
  DiscordApiError: class extends Error {},
}));
vi.mock('@/lib/authn', () => ({ resolveRoleForGuild: mocks.role }));
vi.mock('@/lib/notifications', () => ({
  notifyAdmin: vi.fn(),
  generateStandardSimpleMessage: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getAdminMemberPreferences } from '../preferences';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue({
    guildData: { allowedRoles: ['member'], inactivityEnabled: false },
  });
  mocks.members.mockResolvedValue([
    { user: { id: 'human', username: 'Human' }, roles: ['member'] },
  ]);
  mocks.role.mockResolvedValue('member');
  mocks.preview.mockResolvedValue({
    type: 'success',
    data: {
      evaluatedAt: '2026-04-26T00:00:00.000Z',
      threshold: 3,
      members: [
        {
          discordUserId: 'human',
          username: 'Human',
          displayName: 'Human',
          sessionsPerMonth: 2,
          lastScheduleMonth: '2026-04',
          classification: 'active',
          cutoff: '2026-04-26T00:00:00.000Z',
          firstCountableMonth: '2025-02',
          tracking: {
            firstEligibleAt: '2025-01-15T00:00:00.000Z',
            additionSource: 'schedule_fallback',
            discordJoinedAt: '2025-01-01Z',
          },
          months: [
            { month: '2026-04', status: 'complete', source: 'player', completedAt: '2026-04-01Z' },
          ],
          reasons: ['Full submission in the checked cycles'],
        },
      ],
    },
  });
  mocks.select.mockReturnValue({
    from: (table: Parameters<typeof getTableName>[0]) => {
      if (getTableName(table) === 'inactivity_pauses')
        return { where: () => ({ orderBy: async () => [] }) };
      const where = async () =>
        getTableName(table) === 'member_preferences'
          ? [{ discordUserId: 'human', sessionsPerMonth: 2 }]
          : [];
      return { where, innerJoin: () => ({ where }) };
    },
  });
});
describe('Users Config server boundary', () => {
  it('does not read live preview or return candidate statuses while disabled', async () => {
    const result = await getAdminMemberPreferences('guild-1');
    if (result.type !== 'success') throw new Error('Expected users');
    expect(result.data[0].inactivity).toBe(null);
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.members).toHaveBeenCalledWith({ guildId: 'guild-1' });
  });
  it('reuses enabled preview census and returns only the compact status snapshot', async () => {
    mocks.admin.mockResolvedValue({
      guildData: { allowedRoles: ['member'], inactivityEnabled: true },
    });
    const result = await getAdminMemberPreferences('guild-1');
    if (result.type !== 'success') throw new Error('Expected users');
    expect(result.data[0].inactivity).toEqual({
      classification: 'active',
      lastScheduleMonth: '2026-04',
      details: {
        evaluatedAt: '2026-04-26T00:00:00.000Z',
        threshold: 3,
        cutoff: '2026-04-26T00:00:00.000Z',
        firstCountableMonth: '2025-02',
        firstEligibleAt: '2025-01-15T00:00:00.000Z',
        additionSource: 'schedule_fallback',
        months: [
          { month: '2026-04', status: 'complete', source: 'player', completedAt: '2026-04-01Z' },
        ],
        reasons: ['Full submission in the checked cycles'],
      },
    });
    expect(mocks.preview).toHaveBeenCalledWith('guild-1');
    expect(mocks.members).not.toHaveBeenCalled();
    expect(result.data[0]).not.toHaveProperty('tracking');
    expect(result.data[0].inactivity?.details).not.toHaveProperty('discordJoinedAt');
  });
  it('authorizes before reading any member or activity data', async () => {
    mocks.admin.mockRejectedValue(new Error('Forbidden'));
    expect((await getAdminMemberPreferences('guild-1')).type).toBe('failure');
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.members).not.toHaveBeenCalled();
  });
});
