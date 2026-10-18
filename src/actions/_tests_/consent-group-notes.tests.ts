import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  context: vi.fn(),
  transaction: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  values: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  locks: vi.fn(),
  conflict: vi.fn(),
  revalidate: vi.fn(),
  game: [] as unknown[],
  assignment: [] as unknown[],
  topic: [] as unknown[],
  notes: [] as unknown[],
  created: [] as unknown[],
  updated: [] as unknown[],
}));
vi.mock('@/actions/auth-helpers', () => ({
  ensureAccess: mocks.access,
  getEffectiveUserContext: mocks.context,
}));
vi.mock('@/db/db', () => ({ db: { transaction: mocks.transaction } }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/lib/discord/api', () => ({
  DiscordApiError: class extends Error {},
  RateLimitError: class extends Error {},
}));
import { getGameConsentGroupNote, saveGameConsentGroupNote } from '../consent-group-notes';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.access.mockResolvedValue({
    role: 'member',
    discordAccount: { userId: 'coordinator' },
    guildData: { consentEnabled: true },
    isImpersonating: false,
  });
  mocks.context.mockResolvedValue({ isImpersonating: false });
  mocks.game = [{ mode: 'requested' }];
  mocks.assignment = [{ id: 'membership' }];
  mocks.topic = [{ id: 'topic-1' }];
  mocks.notes = [];
  mocks.created = [{ note: 'Shared note', revision: 1 }];
  mocks.updated = [{ note: 'Updated note', revision: 4 }];
  mocks.select.mockImplementation(() => ({
    from: (table: Parameters<typeof getTableName>[0]) => ({
      where: (condition: unknown) => {
        const name = getTableName(table);
        mocks.where(name, condition);
        const rows =
          name === 'games'
            ? mocks.game
            : name === 'game_members'
              ? mocks.assignment
              : name === 'consent_topics'
                ? mocks.topic
                : mocks.notes;
        return ['games', 'game_members', 'consent_topics'].includes(name)
          ? {
              for: async (strength: string) => {
                mocks.locks(name, strength);
                return rows;
              },
            }
          : Promise.resolve(rows);
      },
    }),
  }));
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.values.mockReturnValue({ onConflictDoNothing: mocks.conflict });
  mocks.conflict.mockReturnValue({ returning: async () => mocks.created });
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.set.mockReturnValue({
    where: (condition: unknown) => {
      mocks.where('update', condition);
      return { returning: async () => mocks.updated };
    },
  });
  mocks.transaction.mockImplementation((callback) =>
    callback({ select: mocks.select, insert: mocks.insert, update: mocks.update }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('coordinator group note edits', () => {
  it('creates an overall group note only if no revision exists, with game/member locks', async () => {
    expect(await saveGameConsentGroupNote('guild-1', 'game-1', null, 'Shared note', 0)).toEqual({
      type: 'success',
      data: { note: 'Shared note', revision: 1 },
    });
    expect(mocks.values).toHaveBeenCalledWith({
      guildId: 'guild-1',
      gameId: 'game-1',
      note: 'Shared note',
    });
    expect(mocks.conflict).toHaveBeenCalled();
    expect(mocks.locks.mock.calls).toEqual([
      ['games', 'share'],
      ['game_members', 'share'],
    ]);
    expect(mocks.revalidate).toHaveBeenCalledWith('/g/guild-1/games/game-1/consent');
    mocks.created = [];
    expect(
      await saveGameConsentGroupNote('guild-1', 'game-1', null, 'Stale creation', 0),
    ).toMatchObject({ type: 'failure', error: expect.stringContaining('draft has been kept') });
  });
  it('updates only the expected topic revision and preserves a tombstone when cleared', async () => {
    mocks.updated = [{ note: '', revision: 4 }];
    expect(await saveGameConsentGroupNote('guild-1', 'game-1', 'topic-1', '  ', 3)).toEqual({
      type: 'success',
      data: { note: '', revision: 4 },
    });
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ note: '', revision: expect.anything() }),
    );
    const condition = mocks.where.mock.calls.find(([name]) => name === 'update')![1];
    const query = new PgDialect().sqlToQuery(condition);
    expect(query.params).toEqual(['guild-1', 'game-1', 'topic-1', 3]);
    expect(query.sql).toContain('revision');
    expect(mocks.locks).toHaveBeenCalledWith('consent_topics', 'share');
    mocks.updated = [];
    expect(
      (await saveGameConsentGroupNote('guild-1', 'game-1', 'topic-1', 'Old draft', 3)).type,
    ).toBe('failure');
  });
  it('reloads latest note/revision without consulting private player responses', async () => {
    expect(await getGameConsentGroupNote('guild-1', 'game-1', 'topic-1')).toEqual({
      type: 'success',
      data: { note: '', revision: 0 },
    });
    mocks.notes = [{ note: 'Latest group note', revision: 5 }];
    expect(await getGameConsentGroupNote('guild-1', 'game-1', 'topic-1')).toEqual({
      type: 'success',
      data: { note: 'Latest group note', revision: 5 },
    });
    expect(
      mocks.where.mock.calls.some(
        ([name]) => name === 'consent_responses' || name === 'consent_checklists',
      ),
    ).toBe(false);
  });
  it('denies ordinary members and unassigned admins, regardless of Requested mode', async () => {
    mocks.assignment = [];
    expect((await saveGameConsentGroupNote('guild-1', 'game-1', null, 'Note', 0)).type).toBe(
      'failure',
    );
    mocks.access.mockResolvedValue({
      role: 'admin',
      discordAccount: { userId: 'admin' },
      guildData: { consentEnabled: true },
    });
    expect((await getGameConsentGroupNote('guild-1', 'game-1', null)).type).toBe('failure');
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('rejects missing/foreign/Off games and non-official topics before writing', async () => {
    mocks.game = [];
    expect((await saveGameConsentGroupNote('guild-1', 'foreign', null, 'Note', 0)).type).toBe(
      'failure',
    );
    mocks.game = [{ mode: 'off' }];
    expect((await saveGameConsentGroupNote('guild-1', 'game-1', null, 'Note', 0)).type).toBe(
      'failure',
    );
    mocks.game = [{ mode: 'optional' }];
    mocks.topic = [];
    expect(
      (await saveGameConsentGroupNote('guild-1', 'game-1', 'foreign-topic', 'Note', 0)).type,
    ).toBe('failure');
    const condition = mocks.where.mock.calls.find(([name]) => name === 'consent_topics')![1];
    expect(new PgDialect().sqlToQuery(condition).sql).toContain('is null');
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('blocks disabled gates and validated cross-guild impersonation before transactions', async () => {
    vi.stubEnv('CONSENT_FEATURE_ENABLED', undefined);
    expect((await saveGameConsentGroupNote('guild-1', 'game-1', null, 'Note', 0)).type).toBe(
      'failure',
    );
    vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
    mocks.context.mockResolvedValueOnce({ isImpersonating: true });
    expect((await saveGameConsentGroupNote('guild-1', 'game-1', null, 'Note', 0)).type).toBe(
      'failure',
    );
    mocks.access.mockResolvedValueOnce({ guildData: { consentEnabled: false } });
    expect((await saveGameConsentGroupNote('guild-1', 'game-1', null, 'Note', 0)).type).toBe(
      'failure',
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('validates note length/revisions and sanitizes unexpected DB failures', async () => {
    expect(
      (await saveGameConsentGroupNote('guild-1', 'game-1', null, 'x'.repeat(10001), 0)).type,
    ).toBe('failure');
    expect((await saveGameConsentGroupNote('guild-1', 'game-1', null, 'Note', -1)).type).toBe(
      'failure',
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
    mocks.insert.mockImplementationOnce(() => {
      throw new Error('secret-query-parameter');
    });
    expect(await saveGameConsentGroupNote('guild-1', 'game-1', null, 'Note', 0)).toEqual({
      type: 'failure',
      error: 'Could not save the group note.',
    });
    expect(vi.mocked(console.error).mock.calls.flat().map(String).join(' ')).not.toContain(
      'secret-query-parameter',
    );
  });
});
