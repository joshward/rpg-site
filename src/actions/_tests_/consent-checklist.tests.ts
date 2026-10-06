import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({
  ensureAccess: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
  where: vi.fn(),
}));

vi.mock('@/actions/auth-helpers', () => ({ ensureAccess: mocks.ensureAccess }));
vi.mock('@/db/db', () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
    delete: mocks.delete,
    transaction: mocks.transaction,
  },
}));

import {
  getMyConsentChecklist,
  saveMyConsentOverallNote,
  saveMyConsentResponse as saveConsentResponse,
  type ConsentResponseInput,
} from '../consent-checklist';
import { consentChecklist, consentResponse } from '@/db/schema/consent-responses';

const topic = { id: 'parent', parentTopicId: null, name: 'Horror', revision: 0 };
const child = { id: 'child', parentTopicId: 'parent', name: 'Spiders', revision: 0 };

function saveMyConsentResponse(
  guildId: string,
  topicId: string,
  input: Omit<ConsentResponseInput, 'expectedTopicRevision'>,
) {
  return saveConsentResponse(guildId, topicId, { ...input, expectedTopicRevision: 0 });
}
const dialect = new PgDialect({ casing: 'snake_case' });

function mockSelect({
  responses = [],
  overallNote = null,
}: {
  responses?: {
    topicId: string;
    answer: 'enthusiastic' | 'veil' | 'line' | null;
    headsUp: boolean;
    note: string | null;
  }[];
  overallNote?: string | null;
} = {}) {
  mocks.select.mockImplementation((fields) => {
    if ('name' in fields) {
      return {
        from: () => ({
          where: (condition: unknown) => {
            mocks.where(condition);
            return { orderBy: async () => [topic, child] };
          },
        }),
      };
    }
    if ('topicId' in fields) {
      return {
        from: () => ({
          where: async (condition: unknown) => {
            mocks.where(condition);
            return responses;
          },
        }),
      };
    }
    if ('overallNote' in fields) {
      return {
        from: () => ({
          where: async (condition: unknown) => {
            mocks.where(condition);
            return overallNote === null ? [] : [{ overallNote }];
          },
        }),
      };
    }
    return {
      from: () => ({
        where: (condition: unknown) => {
          mocks.where(condition);
          return { for: async () => [{ revision: topic.revision }] };
        },
      }),
    };
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
  mocks.ensureAccess.mockResolvedValue({
    guildData: { consentEnabled: true },
    discordAccount: { userId: 'caller-discord-id' },
    isImpersonating: false,
  });
  mocks.transaction.mockImplementation(async (callback) =>
    callback({ select: mocks.select, insert: mocks.insert, delete: mocks.delete }),
  );
  mockSelect();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('private guild checklist actions', () => {
  it('denies reads and writes before auth when the global gate is off', async () => {
    vi.stubEnv('CONSENT_FEATURE_ENABLED', undefined);
    expect((await getMyConsentChecklist('guild-1')).type).toBe('failure');
    expect(
      (
        await saveMyConsentResponse('guild-1', 'parent', {
          answer: 'line',
          headsUp: false,
          note: null,
        })
      ).type,
    ).toBe('failure');
    expect((await saveMyConsentOverallNote('guild-1', 'private')).type).toBe('failure');
    expect(mocks.ensureAccess).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it('denies unauthenticated, outside-guild, or guild-disabled callers before reading private data', async () => {
    mocks.ensureAccess.mockRejectedValueOnce(new Error('Access denied'));
    expect((await getMyConsentChecklist('guild-1')).type).toBe('failure');
    mocks.ensureAccess.mockResolvedValue({
      guildData: { consentEnabled: false },
      discordAccount: { userId: 'caller-discord-id' },
    });
    expect((await getMyConsentChecklist('guild-1')).type).toBe('failure');
    expect(
      (
        await saveMyConsentResponse('guild-1', 'parent', {
          answer: 'line',
          headsUp: false,
          note: null,
        })
      ).type,
    ).toBe('failure');
    expect((await saveMyConsentOverallNote('guild-1', 'private')).type).toBe('failure');
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('never exposes private checklist data through admin impersonation', async () => {
    mocks.ensureAccess.mockResolvedValue({
      guildData: { consentEnabled: true },
      discordAccount: { userId: 'impersonated-discord-id' },
      isImpersonating: true,
    });
    expect((await getMyConsentChecklist('guild-1')).type).toBe('failure');
    expect(
      (
        await saveMyConsentResponse('guild-1', 'parent', {
          answer: 'line',
          headsUp: false,
          note: null,
        })
      ).type,
    ).toBe('failure');
    expect((await saveMyConsentOverallNote('guild-1', 'private')).type).toBe('failure');
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('loads only the caller’s checklist, including private notes and missing official topics', async () => {
    mockSelect({
      responses: [{ topicId: 'child', answer: 'veil', headsUp: true, note: 'private' }],
      overallNote: 'private overall',
    });
    expect(await getMyConsentChecklist('guild-1')).toEqual({
      type: 'success',
      data: {
        topics: [topic, child],
        responses: [{ topicId: 'child', answer: 'veil', headsUp: true, note: 'private' }],
        overallNote: 'private overall',
        complete: false,
        missingTopicIds: ['parent'],
      },
    });
    expect(mocks.ensureAccess).toHaveBeenCalledWith('guild-1');
    expect(mocks.select).toHaveBeenCalledTimes(3);
    const [topicsQuery, responsesQuery, overallQuery] = mocks.where.mock.calls.map(([condition]) =>
      dialect.sqlToQuery(condition),
    );
    expect(topicsQuery.sql).toContain('"consent_topics"."owner_discord_user_id" is null');
    expect(topicsQuery.params).toContain('guild-1');
    expect(responsesQuery.sql).toContain('"consent_responses"."discord_user_id"');
    expect(responsesQuery.params).toContain('caller-discord-id');
    expect(overallQuery.sql).toContain('"consent_checklists"."discord_user_id"');
    expect(overallQuery.params).toContain('caller-discord-id');
  });

  it('requires a valid topic revision from the checklist read before writing', async () => {
    for (const expectedTopicRevision of [undefined, -1, 0.5, Number.NaN]) {
      const result = await saveConsentResponse('guild-1', 'parent', {
        expectedTopicRevision,
        answer: 'line',
        headsUp: false,
        note: null,
      } as never);
      expect(result.type).toBe('failure');
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('rejects stale writes after any rename, even a clear with unchanged wording', async () => {
    mocks.select.mockReturnValue({
      from: () => ({ where: () => ({ for: async () => [{ revision: 1 }] }) }),
    });
    for (const input of [
      { answer: 'line', headsUp: false, note: 'old private note' },
      { answer: null, headsUp: false, note: null },
    ]) {
      expect(await saveMyConsentResponse('guild-1', 'parent', input as never)).toEqual({
        type: 'failure',
        error: 'This topic changed. Reload your checklist before saving.',
      });
    }
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it('permits a fresh response carrying the current topic revision', async () => {
    mocks.select.mockReturnValue({
      from: () => ({ where: () => ({ for: async () => [{ revision: 1 }] }) }),
    });
    const values = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) });
    mocks.insert.mockReturnValue({ values });
    expect(
      (
        await saveConsentResponse('guild-1', 'parent', {
          expectedTopicRevision: 1,
          answer: 'veil',
          headsUp: false,
          note: null,
        })
      ).type,
    ).toBe('success');
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ topicId: 'parent', answer: 'veil' }),
    );
  });

  it('saves an answer with heads-up and notes under the authenticated Discord ID', async () => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    mocks.insert.mockReturnValue({ values });
    expect(
      await saveMyConsentResponse('guild-1', 'parent', {
        answer: 'veil',
        headsUp: true,
        note: 'A private boundary',
      }),
    ).toEqual({ type: 'success', data: undefined });
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.insert).toHaveBeenCalledWith(consentResponse);
    expect(values).toHaveBeenCalledWith({
      guildId: 'guild-1',
      discordUserId: 'caller-discord-id',
      topicId: 'parent',
      answer: 'veil',
      headsUp: true,
      note: 'A private boundary',
    });
    expect(onConflictDoUpdate).toHaveBeenCalledOnce();
    const topicQuery = dialect.sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(topicQuery.sql).toContain('"consent_topics"."owner_discord_user_id" is null');
    expect(topicQuery.params).toEqual(['guild-1', 'parent']);
  });

  it('allows note-only drafts and deletes an empty response, without blocking incomplete sheets', async () => {
    const values = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) });
    mocks.insert.mockReturnValue({ values });
    mocks.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    expect(
      (
        await saveMyConsentResponse('guild-1', 'parent', {
          answer: null,
          headsUp: false,
          note: 'Please discuss',
        })
      ).type,
    ).toBe('success');
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ answer: null, note: 'Please discuss' }),
    );
    expect(
      (await saveMyConsentResponse('guild-1', 'parent', { answer: null, headsUp: false, note: '' }))
        .type,
    ).toBe('success');
    expect(mocks.delete).toHaveBeenCalledWith(consentResponse);
  });

  it('rejects invalid states, oversized notes and nonofficial/cross-guild topic IDs', async () => {
    for (const input of [
      { answer: 'line', headsUp: true, note: null },
      { answer: null, headsUp: true, note: null },
      { answer: 'other', headsUp: false, note: null },
      { answer: 'veil', headsUp: false, note: 'x'.repeat(10001) },
    ]) {
      expect((await saveMyConsentResponse('guild-1', 'parent', input as never)).type).toBe(
        'failure',
      );
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
    mocks.select.mockReturnValue({ from: () => ({ where: () => ({ for: async () => [] }) }) });
    expect(
      (
        await saveMyConsentResponse('guild-1', 'outside', {
          answer: 'line',
          headsUp: false,
          note: null,
        })
      ).type,
    ).toBe('failure');
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('does not log private note values when a database write fails', async () => {
    mocks.insert.mockReturnValue({
      values: () => ({
        onConflictDoUpdate: () =>
          Promise.reject(new Error('sensitive note leaked in query parameters')),
      }),
    });
    expect(
      (
        await saveMyConsentResponse('guild-1', 'parent', {
          answer: 'veil',
          headsUp: false,
          note: 'sensitive note',
        })
      ).type,
    ).toBe('failure');
    expect((await saveMyConsentOverallNote('guild-1', 'sensitive note')).type).toBe('failure');
    expect(vi.mocked(console.error).mock.calls.flat().join(' ')).not.toContain('sensitive note');
  });

  it('saves and removes a private overall note without requiring topic answers', async () => {
    const values = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) });
    mocks.insert.mockReturnValue({ values });
    mocks.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    expect((await saveMyConsentOverallNote('guild-1', 'private overall')).type).toBe('success');
    expect(mocks.insert).toHaveBeenCalledWith(consentChecklist);
    expect(values).toHaveBeenCalledWith({
      guildId: 'guild-1',
      discordUserId: 'caller-discord-id',
      overallNote: 'private overall',
    });
    expect((await saveMyConsentOverallNote('guild-1', null)).type).toBe('success');
    expect(mocks.delete).toHaveBeenCalledWith(consentChecklist);
    expect((await saveMyConsentOverallNote('guild-1', 'x'.repeat(10001))).type).toBe('failure');
  });
});
