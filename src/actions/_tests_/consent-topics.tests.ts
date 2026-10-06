import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({
  ensureAdmin: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/actions/auth-helpers', () => ({ ensureAdmin: mocks.ensureAdmin }));
vi.mock('@/db/db', () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
    update: mocks.update,
    delete: mocks.delete,
    transaction: mocks.transaction,
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import {
  addOfficialConsentTopic,
  deleteOfficialConsentTopic,
  getOfficialConsentTopics,
  renameOfficialConsentTopic,
} from '../consent-topics';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
  mocks.ensureAdmin.mockResolvedValue({ guildData: { consentEnabled: true } });
  mocks.transaction.mockImplementation(async (callback) =>
    callback({ update: mocks.update, delete: mocks.delete }),
  );
  mocks.select.mockReturnValue({ from: () => ({ where: () => Promise.resolve([]) }) });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('official consent topics', () => {
  it('requires the global gate, an admin, and an enabled guild before reading or editing', async () => {
    vi.stubEnv('CONSENT_FEATURE_ENABLED', undefined);
    expect((await getOfficialConsentTopics('guild-1')).type).toBe('failure');
    expect((await addOfficialConsentTopic('guild-1', 'Topic', null)).type).toBe('failure');
    expect(mocks.ensureAdmin).not.toHaveBeenCalled();

    vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
    mocks.ensureAdmin.mockRejectedValue(new Error('Access denied'));
    expect((await getOfficialConsentTopics('guild-1')).type).toBe('failure');
    mocks.ensureAdmin.mockResolvedValue({ guildData: { consentEnabled: false } });
    expect((await addOfficialConsentTopic('guild-1', 'Topic', null)).type).toBe('failure');
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('validates topic names before writing', async () => {
    expect((await addOfficialConsentTopic('guild-1', '  ', null)).type).toBe('failure');
    expect((await addOfficialConsentTopic('guild-1', 'x'.repeat(121), null)).type).toBe('failure');
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('permits only an official main topic from this guild as a subtopic parent', async () => {
    const where = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ parentTopicId: 'other' }]);
    mocks.select.mockReturnValue({ from: () => ({ where }) });
    expect((await addOfficialConsentTopic('guild-1', 'Child', 'missing')).type).toBe('failure');
    expect((await addOfficialConsentTopic('guild-1', 'Child', 'nested')).type).toBe('failure');
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('blocks duplicate names at the same level even with different case or whitespace', async () => {
    mocks.select.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ id: 'existing', name: 'Horror' }]) }),
    });
    const result = await addOfficialConsentTopic('guild-1', '  horror  ', null);
    expect(result).toEqual({
      type: 'failure',
      error: 'An identical topic already exists at this level.',
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('creates a top-level topic and returns it', async () => {
    const topic = { id: 'topic-1', name: 'Spiders', parentTopicId: null };
    const values = vi.fn().mockReturnValue({ returning: () => Promise.resolve([topic]) });
    mocks.insert.mockReturnValue({ values });
    expect(await addOfficialConsentTopic('guild-1', '  Spiders  ', null)).toEqual({
      type: 'success',
      data: topic,
    });
    expect(values).toHaveBeenCalledWith({
      guildId: 'guild-1',
      name: 'Spiders',
      parentTopicId: null,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/g/guild-1/admin');
  });

  it('requires an explicit keep/clear choice when renaming', async () => {
    expect((await renameOfficialConsentTopic('guild-1', 'topic-1', 'New', '' as never)).type).toBe(
      'failure',
    );
    expect(mocks.update).not.toHaveBeenCalled();
    const where = vi
      .fn()
      .mockResolvedValueOnce([{ parentTopicId: null }])
      .mockResolvedValueOnce([]);
    mocks.select.mockReturnValue({ from: () => ({ where }) });
    const set = vi.fn().mockReturnValue({
      where: () => ({ returning: () => Promise.resolve([{ id: 'topic-1' }]) }),
    });
    mocks.update.mockReturnValue({ set });
    expect((await renameOfficialConsentTopic('guild-1', 'topic-1', '  New  ', 'keep')).type).toBe(
      'success',
    );
    expect(set).toHaveBeenCalledWith({ name: 'New', revision: expect.anything() });
    const revisionQuery = new PgDialect({ casing: 'snake_case' }).sqlToQuery(
      set.mock.calls[0][0].revision,
    );
    expect(revisionQuery.sql).toBe('"consent_topics"."revision" + 1');
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it('atomically clears all player responses, heads-up choices and notes for a renamed topic', async () => {
    const where = vi
      .fn()
      .mockResolvedValueOnce([{ parentTopicId: null }])
      .mockResolvedValueOnce([]);
    mocks.select.mockReturnValue({ from: () => ({ where }) });
    const set = vi.fn().mockReturnValue({
      where: () => ({ returning: async () => [{ id: 'topic-1' }] }),
    });
    mocks.update.mockReturnValue({ set });
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    mocks.delete.mockReturnValue({ where: deleteWhere });
    expect((await renameOfficialConsentTopic('guild-1', 'topic-1', 'New', 'clear')).type).toBe(
      'success',
    );
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith({ name: 'New', revision: expect.anything() });
    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(deleteWhere).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/g/guild-1/admin');

    mocks.revalidatePath.mockClear();
    deleteWhere.mockRejectedValueOnce(new Error('Clear failed'));
    expect((await renameOfficialConsentTopic('guild-1', 'topic-1', 'New', 'clear')).type).toBe(
      'failure',
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('bumps the revision even when Clear answers retains the same topic name', async () => {
    const where = vi
      .fn()
      .mockResolvedValueOnce([{ parentTopicId: null }])
      .mockResolvedValueOnce([]);
    mocks.select.mockReturnValue({ from: () => ({ where }) });
    const set = vi.fn().mockReturnValue({
      where: () => ({ returning: async () => [{ id: 'topic-1' }] }),
    });
    mocks.update.mockReturnValue({ set });
    mocks.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    expect((await renameOfficialConsentTopic('guild-1', 'topic-1', 'Horror', 'clear')).type).toBe(
      'success',
    );
    expect(set).toHaveBeenCalledWith({ name: 'Horror', revision: expect.anything() });
    expect(mocks.delete).toHaveBeenCalledOnce();
  });

  it('rejects renaming to a sibling topic name', async () => {
    const where = vi
      .fn()
      .mockResolvedValueOnce([{ parentTopicId: null }])
      .mockResolvedValueOnce([{ id: 'other', name: 'Horror' }]);
    mocks.select.mockReturnValue({ from: () => ({ where }) });
    const result = await renameOfficialConsentTopic('guild-1', 'topic-1', 'horror', 'keep');
    expect(result).toEqual({
      type: 'failure',
      error: 'An identical topic already exists at this level.',
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('deletes an existing official topic', async () => {
    mocks.delete.mockReturnValue({
      where: () => ({ returning: () => Promise.resolve([{ id: 'topic-1' }]) }),
    });
    expect((await deleteOfficialConsentTopic('guild-1', 'topic-1')).type).toBe('success');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/g/guild-1/admin');
  });
});
