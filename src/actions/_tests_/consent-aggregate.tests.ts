import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  context: vi.fn(),
  select: vi.fn(),
  conditions: vi.fn(),
  game: [] as unknown[],
  membership: [] as unknown[],
  members: [] as unknown[],
}));
vi.mock('@/actions/auth-helpers', () => ({
  ensureAccess: mocks.access,
  getEffectiveUserContext: mocks.context,
}));
vi.mock('@/db/db', () => ({ db: { select: mocks.select } }));
vi.mock('@/lib/discord/api', () => ({
  DiscordApiError: class extends Error {},
  RateLimitError: class extends Error {},
}));
import { getGameConsentAggregate } from '../consent-aggregate';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.access.mockResolvedValue({
    role: 'member',
    isImpersonating: false,
    discordAccount: { userId: 'caller' },
    guildData: { consentEnabled: true },
  });
  mocks.context.mockResolvedValue({ isImpersonating: false });
  mocks.game = [{ id: 'game-1', name: 'Game', mode: 'requested' }];
  mocks.membership = [{ coordinator: false }];
  mocks.members = [{ discordUserId: 'caller' }];
  mocks.select.mockImplementation((columns) => ({
    from: () => ({
      where: (condition: unknown) => {
        mocks.conditions(Object.keys(columns), condition);
        if ('mode' in columns) return Promise.resolve(mocks.game);
        if ('coordinator' in columns) return Promise.resolve(mocks.membership);
        if ('parentTopicId' in columns)
          return { orderBy: async () => [{ id: 'topic-1', name: 'Topic', parentTopicId: null }] };
        if ('answer' in columns)
          return Promise.resolve([
            { discordUserId: 'caller', topicId: 'topic-1', answer: 'veil', headsUp: true },
          ]);
        return Promise.resolve(mocks.members);
      },
    }),
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe('aggregate server boundary', () => {
  it('lets Requested members read an aggregate without identities or private notes', async () => {
    const result = await getGameConsentAggregate('guild-1', 'game-1');
    expect(result).toEqual({
      type: 'success',
      data: {
        gameName: 'Game',
        mode: 'requested',
        canViewContributions: false,
        topics: [
          {
            id: 'topic-1',
            name: 'Topic',
            parentTopicId: null,
            answer: 'veil',
            headsUp: true,
            missingAnswers: null,
            hasMissingAnswers: false,
            needsCare: true,
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/caller|discordUserId|note/);
    expect(mocks.select.mock.calls.map(([columns]) => Object.keys(columns)).at(-1)).toEqual([
      'discordUserId',
      'topicId',
      'answer',
      'headsUp',
    ]);
    const conditions = mocks.conditions.mock.calls.map(([keys, condition]) => ({
      keys,
      query: new PgDialect().sqlToQuery(condition),
    }));
    expect(conditions[0].query.params).toEqual(['guild-1', 'game-1']);
    expect(conditions[1].query.params).toEqual(['game-1', 'caller']);
    expect(conditions.at(-1)?.query.params).toEqual(['guild-1', 'caller', 'topic-1']);
  });
  it('requires a coordinator for Optional, not just membership or admin role', async () => {
    mocks.game = [{ id: 'game-1', name: 'Game', mode: 'optional' }];
    expect((await getGameConsentAggregate('guild-1', 'game-1')).type).toBe('failure');
    expect(mocks.select).toHaveBeenCalledTimes(2);
    mocks.access.mockResolvedValue({
      role: 'admin',
      discordAccount: { userId: 'caller' },
      guildData: { consentEnabled: true },
    });
    expect((await getGameConsentAggregate('guild-1', 'game-1')).type).toBe('failure');
    mocks.membership = [{ coordinator: true }];
    expect(await getGameConsentAggregate('guild-1', 'game-1')).toMatchObject({
      type: 'success',
      data: { canViewContributions: true },
    });
  });
  it('reports only missing-answer presence to members, but keeps exact counts for coordinators', async () => {
    mocks.members = [
      { discordUserId: 'caller' },
      { discordUserId: 'other' },
      { discordUserId: 'third' },
    ];
    expect(await getGameConsentAggregate('guild-1', 'game-1')).toMatchObject({
      type: 'success',
      data: { topics: [{ missingAnswers: null, hasMissingAnswers: true }] },
    });
    mocks.membership = [{ coordinator: true }];
    expect(await getGameConsentAggregate('guild-1', 'game-1')).toMatchObject({
      type: 'success',
      data: { topics: [{ missingAnswers: 2, hasMissingAnswers: true }] },
    });
  });

  it('denies nonmembers/removed members even when they are guild admins', async () => {
    mocks.membership = [];
    mocks.access.mockResolvedValue({
      role: 'admin',
      discordAccount: { userId: 'caller' },
      guildData: { consentEnabled: true },
    });
    expect((await getGameConsentAggregate('guild-1', 'game-1')).type).toBe('failure');
    expect(mocks.select).toHaveBeenCalledTimes(2);
  });
  it('denies cross-guild or Off games before any private-data read', async () => {
    mocks.game = [];
    expect((await getGameConsentAggregate('guild-1', 'foreign')).type).toBe('failure');
    mocks.game = [{ id: 'game-1', name: 'Game', mode: 'off' }];
    expect((await getGameConsentAggregate('guild-1', 'game-1')).type).toBe('failure');
    expect(mocks.select).toHaveBeenCalledTimes(2);
  });
  it('denies disabled gates, invalid sessions and cross-guild impersonation before game data', async () => {
    vi.stubEnv('CONSENT_FEATURE_ENABLED', undefined);
    expect((await getGameConsentAggregate('guild-1', 'game-1')).type).toBe('failure');
    vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
    mocks.context.mockResolvedValueOnce({ isImpersonating: true });
    expect((await getGameConsentAggregate('guild-1', 'game-1')).type).toBe('failure');
    mocks.access.mockResolvedValueOnce({ guildData: { consentEnabled: false } });
    expect((await getGameConsentAggregate('guild-1', 'game-1')).type).toBe('failure');
    mocks.access.mockRejectedValueOnce(new Error('Not logged in'));
    expect((await getGameConsentAggregate('guild-1', 'game-1')).type).toBe('failure');
    expect(mocks.select).not.toHaveBeenCalled();
  });
});
