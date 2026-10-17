import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({
  ensureAdmin: vi.fn(),
  assignments: [] as unknown[],
  context: vi.fn(),
  select: vi.fn(),
  responseWhere: vi.fn(),
  assignmentWhere: vi.fn(),
  guildMembers: vi.fn(),
  gameRows: [] as unknown[],
  topicRows: [] as unknown[],
  memberRows: [] as unknown[],
  responseRows: [] as unknown[],
}));
vi.mock('@/actions/auth-helpers', () => ({
  ensureAccess: mocks.ensureAdmin,
  getEffectiveUserContext: mocks.context,
}));
vi.mock('@/db/db', () => ({ db: { select: mocks.select } }));
vi.mock('@/lib/discord/api', () => ({
  getGuildMembers: mocks.guildMembers,
  DiscordApiError: class extends Error {},
  RateLimitError: class extends Error {},
}));

import { getGameConsentStatus } from '../consent-game-status';

const topics = [
  { id: 'parent', parentTopicId: null },
  { id: 'child', parentTopicId: 'parent' },
  { id: 'other', parentTopicId: null },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.ensureAdmin.mockResolvedValue({
    isImpersonating: false,
    role: 'admin',
    discordAccount: { userId: 'ada' },
    guildData: { consentEnabled: true },
  });
  mocks.assignments = [];
  mocks.context.mockResolvedValue({ isImpersonating: false });
  mocks.gameRows = [{ id: 'game-1', name: 'Game', consentMode: 'optional' }];
  mocks.topicRows = topics;
  mocks.memberRows = [{ discordUserId: 'ada' }, { discordUserId: 'bob' }, { discordUserId: 'cy' }];
  mocks.responseRows = [
    { discordUserId: 'ada', topicId: 'parent' },
    { discordUserId: 'bob', topicId: 'parent' },
    { discordUserId: 'bob', topicId: 'other' },
    { discordUserId: 'outsider', topicId: 'parent' },
  ];
  mocks.guildMembers.mockResolvedValue(
    ['ada', 'bob', 'cy'].map((id) => ({ user: { id, username: id } })),
  );
  mocks.select.mockImplementation((columns: Record<string, unknown>) => {
    let rows: unknown[];
    if ('consentMode' in columns) rows = mocks.gameRows;
    else if ('parentTopicId' in columns) rows = mocks.topicRows;
    else if ('topicId' in columns) rows = mocks.responseRows;
    else if ('id' in columns) rows = mocks.assignments;
    else rows = mocks.memberRows;
    return {
      from: () => ({
        where: (condition: unknown) => {
          if ('topicId' in columns) mocks.responseWhere(condition);
          if ('id' in columns && !('consentMode' in columns) && !('parentTopicId' in columns))
            mocks.assignmentWhere(condition);
          return 'parentTopicId' in columns ? { orderBy: async () => rows } : Promise.resolve(rows);
        },
      }),
    };
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('admin or explicitly assigned member game consent status', () => {
  it('returns only member names and status, never answers, heads-up choices or private notes', async () => {
    const result = await getGameConsentStatus('guild-1', 'game-1');
    expect(result).toEqual({
      type: 'success',
      data: {
        gameName: 'Game',
        mode: 'optional',
        hasTopics: true,
        members: [
          { discordUserId: 'ada', displayName: 'ada', status: 'in-progress' },
          { discordUserId: 'bob', displayName: 'bob', status: 'complete' },
          { discordUserId: 'cy', displayName: 'cy', status: 'not-started' },
        ],
      },
    });
    const responseProjection = mocks.select.mock.calls.find(([fields]) => 'topicId' in fields)?.[0];
    expect(Object.keys(responseProjection)).toEqual(['discordUserId', 'topicId']);
    expect(new PgDialect().sqlToQuery(mocks.responseWhere.mock.calls[0][0]).sql).toContain(
      '"answer" is not null',
    );
    expect(JSON.stringify(result)).not.toMatch(/private|enthusiastic|veil|line|headsUp|topicId/);
  });

  it('denies feature-off, guild-off, impersonating and non-admin callers before DB reads', async () => {
    vi.stubEnv('CONSENT_FEATURE_ENABLED', undefined);
    expect((await getGameConsentStatus('guild-1', 'game-1')).type).toBe('failure');
    vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
    mocks.ensureAdmin.mockResolvedValueOnce({
      isImpersonating: false,
      guildData: { consentEnabled: false },
    });
    expect((await getGameConsentStatus('guild-1', 'game-1')).type).toBe('failure');
    mocks.ensureAdmin.mockResolvedValueOnce({
      isImpersonating: true,
      guildData: { consentEnabled: true },
    });
    expect((await getGameConsentStatus('guild-1', 'game-1')).type).toBe('failure');
    mocks.ensureAdmin.mockRejectedValueOnce(
      new Error('Only guild administrators can perform this action.'),
    );
    expect((await getGameConsentStatus('guild-1', 'game-1')).type).toBe('failure');
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it('denies active cross-guild impersonation even if ensureAdmin falls back to the real admin', async () => {
    // The impersonated user has no access to guild-1, so ensureAdmin reports
    // the real admin and isImpersonating: false. The cookie context is active.
    mocks.context.mockResolvedValueOnce({ isImpersonating: true });
    expect((await getGameConsentStatus('guild-1', 'game-1')).type).toBe('failure');
    expect(mocks.context).toHaveBeenCalledWith('guild-1');
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it('permits an assigned member, but denies an unassigned or removed member', async () => {
    mocks.ensureAdmin.mockResolvedValue({
      role: 'member',
      discordAccount: { userId: 'ada' },
      isImpersonating: false,
      guildData: { consentEnabled: true },
    });
    expect((await getGameConsentStatus('guild-1', 'game-1')).type).toBe('failure');
    expect(mocks.responseWhere).not.toHaveBeenCalled();
    const assignmentQuery = new PgDialect({ casing: 'snake_case' }).sqlToQuery(
      mocks.assignmentWhere.mock.calls[0][0],
    );
    expect(assignmentQuery.params).toEqual(['game-1', 'ada', true]);
    expect(assignmentQuery.sql).toContain('"is_consent_coordinator"');
    mocks.assignments = [{ id: 'membership-1' }];
    expect((await getGameConsentStatus('guild-1', 'game-1')).type).toBe('success');
    mocks.assignments = [];
    expect((await getGameConsentStatus('guild-1', 'game-1')).type).toBe('failure');
  });

  it('denies a game outside the guild or in Off mode before reading responses', async () => {
    mocks.gameRows = [];
    expect((await getGameConsentStatus('guild-1', 'other-game')).type).toBe('failure');
    mocks.gameRows = [{ id: 'game-1', name: 'Game', consentMode: 'off' }];
    expect((await getGameConsentStatus('guild-1', 'game-1')).type).toBe('failure');
    expect(mocks.select).toHaveBeenCalledTimes(2);
    expect(mocks.guildMembers).not.toHaveBeenCalled();
  });

  it('does not query private responses when the game has no members', async () => {
    mocks.memberRows = [];
    expect(await getGameConsentStatus('guild-1', 'game-1')).toEqual({
      type: 'success',
      data: { gameName: 'Game', mode: 'optional', hasTopics: true, members: [] },
    });
    expect(mocks.select).toHaveBeenCalledTimes(3);
    expect(mocks.responseWhere).not.toHaveBeenCalled();
    expect(mocks.guildMembers).not.toHaveBeenCalled();
  });

  it('allows Requested mode but does not mark an empty catalog complete', async () => {
    mocks.gameRows = [{ id: 'game-1', name: 'Game', consentMode: 'requested' }];
    mocks.topicRows = [];
    expect(await getGameConsentStatus('guild-1', 'game-1')).toEqual({
      type: 'success',
      data: { gameName: 'Game', mode: 'requested', hasTopics: false, members: [] },
    });
    expect(mocks.select).toHaveBeenCalledTimes(2);
    expect(mocks.guildMembers).not.toHaveBeenCalled();
  });
});
