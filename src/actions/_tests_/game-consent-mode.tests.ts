import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({
  ensureAdmin: vi.fn(),
  context: vi.fn(),
  transaction: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  deleteWhere: vi.fn(),
  inserted: vi.fn(),
  conflict: vi.fn(),
  updated: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock('@/actions/auth-helpers', () => ({
  ensureAdmin: mocks.ensureAdmin,
  ensureAccess: vi.fn(),
  getEffectiveUserContext: mocks.context,
}));
vi.mock('@/db/db', () => ({ db: { transaction: mocks.transaction } }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/discord/api', () => ({
  getGuildMembers: vi.fn(),
  DiscordApiError: class extends Error {},
  RateLimitError: class extends Error {},
}));

import { createGame, updateGame, type GameFormData } from '../games';

const data: GameFormData = {
  name: 'A game',
  description: null,
  status: 'draft',
  sessionsPerMonth: 2,
  members: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.context.mockResolvedValue({ isImpersonating: false });
  mocks.ensureAdmin.mockResolvedValue({
    guildData: { consentEnabled: true },
    isImpersonating: false,
  });
  mocks.insert.mockReturnValue({
    values: (value: unknown) => {
      mocks.inserted(value);
      return { returning: async () => [{ id: 'game-1' }], onConflictDoUpdate: mocks.conflict };
    },
  });
  mocks.select.mockReturnValue({ from: () => ({ where: async () => [{ id: 'game-1' }] }) });
  mocks.update.mockReturnValue({
    set: (value: unknown) => {
      mocks.updated(value);
      return { where: () => ({ returning: async () => [{ id: 'game-1' }] }) };
    },
  });
  mocks.delete.mockReturnValue({ where: mocks.deleteWhere });
  mocks.transaction.mockImplementation((callback) =>
    callback({
      insert: mocks.insert,
      select: mocks.select,
      update: mocks.update,
      delete: mocks.delete,
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('consent mode in game saves', () => {
  it('preserves the stored mode when the field is hidden or absent', async () => {
    vi.stubEnv('CONSENT_FEATURE_ENABLED', undefined);
    expect((await createGame('guild-1', data)).type).toBe('success');
    expect(mocks.inserted.mock.calls[0][0]).not.toHaveProperty('consentMode');
    expect((await updateGame('guild-1', 'game-1', data)).type).toBe('success');
    expect(mocks.updated.mock.calls[0][0]).not.toHaveProperty('consentMode');
  });

  it('saves mode with other fields in the same game transaction', async () => {
    expect((await createGame('guild-1', { ...data, consentMode: 'optional' })).type).toBe(
      'success',
    );
    expect(mocks.inserted.mock.calls[0][0]).toMatchObject({
      name: 'A game',
      consentMode: 'optional',
    });
    expect(
      (await updateGame('guild-1', 'game-1', { ...data, consentMode: 'requested' })).type,
    ).toBe('success');
    expect(mocks.updated.mock.calls[0][0]).toMatchObject({
      name: 'A game',
      consentMode: 'requested',
    });
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
  });

  it('preserves coordinator assignments when membership flags are omitted', async () => {
    const member = { discordUserId: 'player-1', isRequired: true };
    expect((await updateGame('guild-1', 'game-1', { ...data, members: [member] })).type).toBe(
      'success',
    );
    const inserted = mocks.inserted.mock.calls[0][0];
    expect(inserted).toEqual([{ gameId: 'game-1', discordUserId: 'player-1', isRequired: true }]);
    expect(Object.keys(mocks.conflict.mock.calls[0][0].set)).toEqual(['isRequired']);
    const deletion = new PgDialect().sqlToQuery(mocks.deleteWhere.mock.calls[0][0]);
    expect(deletion.sql).toContain('not in');
    expect(deletion.params).toEqual(['game-1', 'player-1']);
  });

  it('saves coordinator checkboxes in the same game transaction', async () => {
    const members = [{ discordUserId: 'player-1', isRequired: true, isConsentCoordinator: true }];
    expect((await updateGame('guild-1', 'game-1', { ...data, members })).type).toBe('success');
    expect(mocks.updated).toHaveBeenLastCalledWith({ isConsentCoordinator: true });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects forged coordinator flags for unavailable consent, impersonation or invalid values', async () => {
    const members = [{ discordUserId: 'player-1', isRequired: true, isConsentCoordinator: true }];
    vi.stubEnv('CONSENT_FEATURE_ENABLED', undefined);
    expect((await updateGame('guild-1', 'game-1', { ...data, members })).type).toBe('failure');
    vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
    mocks.context.mockResolvedValueOnce({ isImpersonating: true });
    expect((await createGame('guild-1', { ...data, members })).type).toBe('failure');
    expect(
      (
        await createGame('guild-1', {
          ...data,
          members: [{ ...members[0], isConsentCoordinator: 'yes' as never }],
        })
      ).type,
    ).toBe('failure');
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('rejects forged mode changes when the feature or guild is Off or during impersonation', async () => {
    vi.stubEnv('CONSENT_FEATURE_ENABLED', undefined);
    expect(
      (await updateGame('guild-1', 'game-1', { ...data, consentMode: 'requested' })).type,
    ).toBe('failure');
    vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
    mocks.ensureAdmin.mockResolvedValueOnce({
      guildData: { consentEnabled: false },
      isImpersonating: false,
    });
    expect((await createGame('guild-1', { ...data, consentMode: 'optional' })).type).toBe(
      'failure',
    );
    mocks.ensureAdmin.mockResolvedValueOnce({
      guildData: { consentEnabled: true },
      isImpersonating: true,
    });
    expect((await updateGame('guild-1', 'game-1', { ...data, consentMode: 'off' })).type).toBe(
      'failure',
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('rejects unrecognized modes and non-admin callers before touching the database', async () => {
    expect((await createGame('guild-1', { ...data, consentMode: 'invalid' as never })).type).toBe(
      'failure',
    );
    mocks.ensureAdmin.mockRejectedValueOnce(new Error('Not an admin'));
    expect(
      (await updateGame('guild-1', 'game-1', { ...data, consentMode: 'requested' })).type,
    ).toBe('failure');
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
