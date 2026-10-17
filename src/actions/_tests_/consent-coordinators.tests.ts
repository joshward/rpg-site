import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  context: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  revalidate: vi.fn(),
  game: [] as unknown[],
  updated: [] as unknown[],
}));
vi.mock('@/actions/auth-helpers', () => ({
  ensureAdmin: mocks.admin,
  getEffectiveUserContext: mocks.context,
}));
vi.mock('@/db/db', () => ({ db: { select: mocks.select, update: mocks.update } }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/lib/discord/api', () => ({
  DiscordApiError: class extends Error {},
  RateLimitError: class extends Error {},
}));
import { setConsentCoordinator } from '../consent-coordinators';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.admin.mockResolvedValue({ isImpersonating: false, guildData: { consentEnabled: true } });
  mocks.context.mockResolvedValue({ isImpersonating: false });
  mocks.game = [{ mode: 'optional' }];
  mocks.updated = [{ id: 'member-1' }];
  mocks.select.mockReturnValue({ from: () => ({ where: async () => mocks.game }) });
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.set.mockReturnValue({ where: mocks.where });
  mocks.where.mockImplementation(() => ({ returning: async () => mocks.updated }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('coordinator assignment boundary', () => {
  it('updates only an existing member of the selected game and supports revocation', async () => {
    expect((await setConsentCoordinator('guild-1', 'game-1', 'player-1', true)).type).toBe(
      'success',
    );
    expect(mocks.set).toHaveBeenCalledWith({ isConsentCoordinator: true });
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(query.params).toEqual(['game-1', 'player-1']);
    expect((await setConsentCoordinator('guild-1', 'game-1', 'player-1', false)).type).toBe(
      'success',
    );
    expect(mocks.set).toHaveBeenLastCalledWith({ isConsentCoordinator: false });
    mocks.updated = [];
    expect((await setConsentCoordinator('guild-1', 'game-1', 'non-member', true)).type).toBe(
      'failure',
    );
  });
  it('denies non-admin and cross-guild impersonation before writing', async () => {
    mocks.admin.mockRejectedValueOnce(new Error('Not admin'));
    expect((await setConsentCoordinator('guild-1', 'game-1', 'player-1', true)).type).toBe(
      'failure',
    );
    mocks.context.mockResolvedValueOnce({ isImpersonating: true });
    expect((await setConsentCoordinator('guild-1', 'game-1', 'player-1', true)).type).toBe(
      'failure',
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('denies Off modes, missing/foreign games, and disabled feature or guild', async () => {
    for (const rows of [[], [{ mode: 'off' }]]) {
      mocks.game = rows;
      expect((await setConsentCoordinator('guild-1', 'game-1', 'player-1', true)).type).toBe(
        'failure',
      );
    }
    mocks.game = [{ mode: 'requested' }];
    vi.stubEnv('CONSENT_FEATURE_ENABLED', undefined);
    expect((await setConsentCoordinator('guild-1', 'game-1', 'player-1', true)).type).toBe(
      'failure',
    );
    vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
    mocks.admin.mockResolvedValueOnce({
      isImpersonating: false,
      guildData: { consentEnabled: false },
    });
    expect((await setConsentCoordinator('guild-1', 'game-1', 'player-1', true)).type).toBe(
      'failure',
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
