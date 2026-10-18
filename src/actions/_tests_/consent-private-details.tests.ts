import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  context: vi.fn(),
  select: vi.fn(),
  where: vi.fn(),
  guildMembers: vi.fn(),
  game: [] as unknown[],
  assignment: [] as unknown[],
  topics: [] as unknown[],
  members: [] as unknown[],
  responses: [] as unknown[],
  notes: [] as unknown[],
}));
vi.mock('@/actions/auth-helpers', () => ({
  ensureAccess: mocks.access,
  getEffectiveUserContext: mocks.context,
}));
vi.mock('@/db/db', () => ({ db: { select: mocks.select } }));
vi.mock('@/lib/discord/api', () => ({
  getGuildMembers: mocks.guildMembers,
  DiscordApiError: class extends Error {},
  RateLimitError: class extends Error {},
}));
import { getGameConsentTopicDetails, getGameConsentOverallNotes } from '../consent-private-details';

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
  mocks.game = [{ mode: 'optional' }];
  mocks.assignment = [{ id: 'membership' }];
  mocks.topics = [{ id: 'child', parentTopicId: 'parent' }];
  mocks.members = [{ discordUserId: 'a' }, { discordUserId: 'b' }];
  mocks.responses = [
    { discordUserId: 'a', topicId: 'parent', answer: 'line', headsUp: false, note: 'Parent A' },
    {
      discordUserId: 'a',
      topicId: 'child',
      answer: 'enthusiastic',
      headsUp: true,
      note: 'Child A',
    },
    { discordUserId: 'b', topicId: 'parent', answer: 'veil', headsUp: true, note: 'Parent B' },
    { discordUserId: 'b', topicId: 'child', answer: null, headsUp: false, note: 'Note-only B' },
    { discordUserId: 'outsider', topicId: 'child', answer: 'line', note: 'Other player secret' },
  ];
  mocks.notes = [
    { discordUserId: 'a', overallNote: 'Overall A' },
    { discordUserId: 'outsider', overallNote: 'Other overall secret' },
  ];
  mocks.guildMembers.mockResolvedValue(['a', 'b'].map((id) => ({ user: { id, username: id } })));
  mocks.select.mockImplementation((columns) => ({
    from: () => ({
      where: async (condition: unknown) => {
        mocks.where(Object.keys(columns), condition);
        if ('mode' in columns) return mocks.game;
        if ('parentTopicId' in columns) return mocks.topics;
        if ('answer' in columns) return mocks.responses;
        if ('overallNote' in columns) return mocks.notes;
        if ('id' in columns) return mocks.assignment;
        return mocks.members;
      },
    }),
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('coordinator-only private consent reads', () => {
  it('returns current members only with explicit/inherited choices and separately labelled notes', async () => {
    expect(await getGameConsentTopicDetails('guild-1', 'game-1', 'child')).toEqual({
      type: 'success',
      data: [
        {
          discordUserId: 'a',
          displayName: 'a',
          answer: 'enthusiastic',
          headsUp: true,
          source: 'explicit',
          note: 'Child A',
          parentNote: null,
        },
        {
          discordUserId: 'b',
          displayName: 'b',
          answer: 'veil',
          headsUp: true,
          source: 'inherited',
          note: 'Note-only B',
          parentNote: 'Parent B',
        },
      ],
    });
    const queries = mocks.where.mock.calls.map(([keys, condition]) => ({
      keys,
      ...new PgDialect().sqlToQuery(condition),
    }));
    expect(queries[0].params).toEqual(['guild-1', 'game-1']);
    expect(queries[1].params).toEqual(['game-1', 'coordinator', true]);
    const responseQuery = queries.find((query) => query.keys.includes('answer'))!;
    expect(responseQuery.params).toEqual(['guild-1', 'a', 'b', 'child', 'parent']);
    expect(queries.find((query) => query.keys.includes('parentTopicId'))?.sql).toContain('is null');
  });
  it('returns overall notes only for current game members', async () => {
    expect(await getGameConsentOverallNotes('guild-1', 'game-1')).toEqual({
      type: 'success',
      data: [
        { discordUserId: 'a', displayName: 'a', note: 'Overall A' },
        { discordUserId: 'b', displayName: 'b', note: null },
      ],
    });
    const condition = mocks.where.mock.calls.find(([keys]) => keys.includes('overallNote'))![1];
    expect(new PgDialect().sqlToQuery(condition).params).toEqual(['guild-1', 'a', 'b']);
  });
  it('never gives ordinary members or unassigned admins private data, and revocation applies on each read', async () => {
    mocks.assignment = [];
    expect((await getGameConsentTopicDetails('guild-1', 'game-1', 'child')).type).toBe('failure');
    mocks.access.mockResolvedValue({
      role: 'admin',
      discordAccount: { userId: 'admin' },
      guildData: { consentEnabled: true },
    });
    expect((await getGameConsentOverallNotes('guild-1', 'game-1')).type).toBe('failure');
    expect(
      mocks.where.mock.calls.every(
        ([keys]) => keys.includes('mode') || (keys.length === 1 && keys[0] === 'id'),
      ),
    ).toBe(true);
    expect(mocks.guildMembers).not.toHaveBeenCalled();
  });
  it('checks disabled gates and validated cross-guild impersonation before any data read', async () => {
    vi.stubEnv('CONSENT_FEATURE_ENABLED', undefined);
    expect((await getGameConsentTopicDetails('guild-1', 'game-1', 'child')).type).toBe('failure');
    vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
    mocks.context.mockResolvedValueOnce({ isImpersonating: true });
    expect((await getGameConsentOverallNotes('guild-1', 'game-1')).type).toBe('failure');
    mocks.access.mockResolvedValueOnce({ guildData: { consentEnabled: false } });
    expect((await getGameConsentOverallNotes('guild-1', 'game-1')).type).toBe('failure');
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it('rejects foreign/Off games and unofficial/foreign topics before private responses', async () => {
    mocks.game = [];
    expect((await getGameConsentTopicDetails('guild-1', 'foreign', 'child')).type).toBe('failure');
    mocks.game = [{ mode: 'off' }];
    expect((await getGameConsentOverallNotes('guild-1', 'game-1')).type).toBe('failure');
    mocks.game = [{ mode: 'requested' }];
    mocks.topics = [];
    expect((await getGameConsentTopicDetails('guild-1', 'game-1', 'foreign-topic')).type).toBe(
      'failure',
    );
    expect(
      mocks.where.mock.calls.some(
        ([keys]) => keys.includes('answer') || keys.includes('overallNote'),
      ),
    ).toBe(false);
  });
  it('sanitizes unexpected errors before logging or returning', async () => {
    mocks.select.mockImplementationOnce(() => {
      throw new Error('private-secret-db-error');
    });
    const result = await getGameConsentOverallNotes('guild-1', 'game-1');
    expect(result).toEqual({ type: 'failure', error: 'Could not load private overall notes.' });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      'private-secret-db-error',
    );
  });
});
