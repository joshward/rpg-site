import { describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ select: vi.fn(), members: vi.fn() }));
vi.mock('@/db/db', () => ({ db: { select: mocks.select } }));
vi.mock('@/lib/discord/api', () => ({ getGuildMembers: mocks.members }));
vi.mock('@/lib/authn', () => ({ resolveRoleForGuild: async () => 'member' }));
import { getPlayerCohorts } from '../cohorts';

describe('reminder cohorts after inactivity zeroing', () => {
  it('excludes zero preferences even for required players, retaining No Limit', async () => {
    mocks.members.mockResolvedValue(
      ['zeroed', 'unlimited'].map((id) => ({ user: { id }, roles: ['allowed'] })),
    );
    const results = [
      [
        { discordUserId: 'zeroed', sessionsPerMonth: 0 },
        { discordUserId: 'unlimited', sessionsPerMonth: -1 },
      ],
      [{ id: 'game' }],
      [
        { discordUserId: 'zeroed', isRequired: true },
        { discordUserId: 'unlimited', isRequired: true },
      ],
      [],
    ];
    mocks.select.mockImplementation(() => ({
      from: () => ({ where: async () => results.shift() }),
    }));
    const cohorts = await getPlayerCohorts({
      guildId: 'a',
      allowedRoles: ['allowed'],
      target: { year: 2028, month: 5 },
    });
    expect(cohorts.missingCore.map((p) => p.user.id)).toEqual(['unlimited']);
    expect(cohorts.corePlayers.map((p) => p.user.id)).toEqual(['unlimited']);
    expect(cohorts.missingOptional).toEqual([]);
  });
});
