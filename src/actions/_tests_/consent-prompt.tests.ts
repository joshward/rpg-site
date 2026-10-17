import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  context: vi.fn(),
  select: vi.fn(),
  gameWhere: vi.fn(),
  answerWhere: vi.fn(),
  games: [] as unknown[],
  topics: [] as unknown[],
  answers: [] as unknown[],
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
import { getMyConsentPrompt } from '../consent-prompt';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.access.mockResolvedValue({
    isImpersonating: false,
    discordAccount: { userId: 'self' },
    guildData: { consentEnabled: true },
  });
  mocks.context.mockResolvedValue({ isImpersonating: false });
  mocks.games = [{ id: 'game-1' }];
  mocks.topics = [
    { id: 'parent', parentTopicId: null },
    { id: 'child', parentTopicId: 'parent' },
  ];
  mocks.answers = [];
  mocks.select.mockImplementation((columns) => ({
    from: () => {
      if ('parentTopicId' in columns) return { where: async () => mocks.topics };
      if ('topicId' in columns)
        return {
          where: async (condition: unknown) => {
            mocks.answerWhere(condition);
            return mocks.answers;
          },
        };
      return {
        innerJoin: () => ({
          where: (condition: unknown) => {
            mocks.gameWhere(condition);
            return { limit: async () => mocks.games };
          },
        }),
      };
    },
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('automatic Requested checklist prompt', () => {
  it('returns a boolean only, scoped to own active/paused Requested games and official answers', async () => {
    expect(await getMyConsentPrompt('guild-1')).toEqual({ type: 'success', data: true });
    const gameQuery = new PgDialect().sqlToQuery(mocks.gameWhere.mock.calls[0][0]);
    expect(gameQuery.params).toEqual(['guild-1', 'self', 'requested', 'active', 'paused']);
    const answerQuery = new PgDialect().sqlToQuery(mocks.answerWhere.mock.calls[0][0]);
    expect(answerQuery.params).toEqual(['guild-1', 'self', 'parent', 'child']);
    expect(answerQuery.sql).toContain('"answer" is not null');
    expect(Object.keys(mocks.select.mock.calls[2][0])).toEqual(['topicId']);
  });
  it('hides after completion using parent fallback, but a child alone is incomplete', async () => {
    mocks.answers = [{ topicId: 'parent' }];
    expect(await getMyConsentPrompt('guild-1')).toEqual({ type: 'success', data: false });
    mocks.answers = [{ topicId: 'child' }];
    expect(await getMyConsentPrompt('guild-1')).toEqual({ type: 'success', data: true });
  });
  it('does not read responses without a qualifying game or configured topics', async () => {
    mocks.games = [];
    expect(await getMyConsentPrompt('guild-1')).toEqual({ type: 'success', data: false });
    expect(mocks.select).toHaveBeenCalledTimes(1);
    mocks.games = [{ id: 'game-1' }];
    mocks.topics = [];
    expect(await getMyConsentPrompt('guild-1')).toEqual({ type: 'success', data: false });
    expect(mocks.answerWhere).not.toHaveBeenCalled();
  });
  it('denies unauthenticated callers and suppresses impersonation and disabled gates', async () => {
    vi.stubEnv('CONSENT_FEATURE_ENABLED', undefined);
    expect(await getMyConsentPrompt('guild-1')).toEqual({ type: 'success', data: false });
    expect(mocks.access).not.toHaveBeenCalled();
    vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
    mocks.context.mockResolvedValueOnce({ isImpersonating: true });
    expect(await getMyConsentPrompt('guild-1')).toEqual({ type: 'success', data: false });
    mocks.access.mockResolvedValueOnce({ guildData: { consentEnabled: false } });
    expect(await getMyConsentPrompt('guild-1')).toEqual({ type: 'success', data: false });
    mocks.access.mockRejectedValueOnce(new Error('Not logged in'));
    expect((await getMyConsentPrompt('guild-1')).type).toBe('failure');
    expect(mocks.select).not.toHaveBeenCalled();
  });
});
