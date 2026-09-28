import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ensureAdmin: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/actions/auth-helpers', () => ({ ensureAdmin: mocks.ensureAdmin }));
vi.mock('@/db/db', () => ({
  db: {
    select: mocks.select,
    transaction: mocks.transaction,
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { getConsentAdminSettings, saveConsentAdminSettings } from '../consent-admin';

function mockSave(current: { enabled: boolean; seededAt: Date | null }, existingTopics = false) {
  mocks.select.mockReturnValue({
    from: () => ({
      where: () => ({
        for: async () => [current],
        limit: async () => (existingTopics ? [{ id: 'existing-topic' }] : []),
      }),
    }),
  });
  const set = vi.fn().mockReturnValue({
    where: () => ({ returning: async () => [{ id: 'guild-1' }] }),
  });
  mocks.update.mockReturnValue({ set });
  return set;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
  mocks.transaction.mockImplementation(async (callback) =>
    callback({ select: mocks.select, insert: mocks.insert, update: mocks.update }),
  );
  mocks.insert.mockImplementation(() => ({ values: vi.fn().mockResolvedValue(undefined) }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('guild consent settings', () => {
  it('rejects reads and writes while the global gate is off, before accessing data', async () => {
    vi.stubEnv('CONSENT_FEATURE_ENABLED', undefined);
    expect((await getConsentAdminSettings('guild-1')).type).toBe('failure');
    expect((await saveConsentAdminSettings('guild-1', true, '')).type).toBe('failure');
    expect(mocks.ensureAdmin).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('rejects non-admins even if the gate is on', async () => {
    mocks.ensureAdmin.mockRejectedValue(new Error('Access denied'));
    expect((await getConsentAdminSettings('guild-1')).type).toBe('failure');
    expect((await saveConsentAdminSettings('guild-1', true, '')).type).toBe('failure');
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('initializes a fresh guild catalog on first enable', async () => {
    mocks.select.mockReturnValueOnce({
      from: () => ({ where: async () => [{ enabled: false, guidance: null }] }),
    });
    expect(await getConsentAdminSettings('guild-1')).toEqual({
      type: 'success',
      data: { enabled: false, guidance: null },
    });

    const set = mockSave({ enabled: false, seededAt: null });
    expect(await saveConsentAdminSettings('guild-1', true, '  Custom guidance  ')).toEqual({
      type: 'success',
      data: { enabled: true },
    });
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    const [parents, children] = mocks.insert.mock.results.map(
      (result) =>
        result.value.values.mock.calls[0][0] as { guildId: string; parentTopicId: string | null }[],
    );
    expect(parents).toHaveLength(21);
    expect(children).toHaveLength(24);
    expect(parents.every((row) => row.guildId === 'guild-1' && row.parentTopicId === null)).toBe(
      true,
    );
    expect(children.every((row) => row.guildId === 'guild-1')).toBe(true);
    expect(set).toHaveBeenCalledWith({
      consentEnabled: true,
      consentGuidance: 'Custom guidance',
      consentTopicsSeededAt: expect.any(Date),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/g/guild-1/admin');
  });

  it('does not seed or mark an untouched, disabled guild', async () => {
    const set = mockSave({ enabled: false, seededAt: null });
    expect((await saveConsentAdminSettings('guild-1', false, '')).type).toBe('success');
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({ consentEnabled: false, consentGuidance: null });
  });

  it('preserves a previously configured catalog and marks it as initialized', async () => {
    const set = mockSave({ enabled: false, seededAt: null }, true);
    expect((await saveConsentAdminSettings('guild-1', true, '')).type).toBe('success');
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({
      consentEnabled: true,
      consentGuidance: null,
      consentTopicsSeededAt: expect.any(Date),
    });
  });

  it('never re-seeds after the one-time marker, even when all topics are gone', async () => {
    const set = mockSave({ enabled: false, seededAt: new Date() });
    expect((await saveConsentAdminSettings('guild-1', true, '')).type).toBe('success');
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({ consentEnabled: true, consentGuidance: null });
  });

  it('does not seed a guild that was already enabled before this feature was deployed', async () => {
    const set = mockSave({ enabled: true, seededAt: null });
    expect((await saveConsentAdminSettings('guild-1', true, '')).type).toBe('success');
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({
      consentEnabled: true,
      consentGuidance: null,
      consentTopicsSeededAt: expect.any(Date),
    });
  });

  it('does not enable the guild if starter insertion fails', async () => {
    mockSave({ enabled: false, seededAt: null });
    mocks.insert.mockReturnValue({ values: vi.fn().mockRejectedValue(new Error('Insert failed')) });
    expect((await saveConsentAdminSettings('guild-1', true, '')).type).toBe('failure');
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects malformed input instead of writing it', async () => {
    expect((await saveConsentAdminSettings('guild-1', 'true' as never, '')).type).toBe('failure');
    expect((await saveConsentAdminSettings('guild-1', true, 'a'.repeat(10001))).type).toBe(
      'failure',
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
