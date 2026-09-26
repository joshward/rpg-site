import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ensureAdmin: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/actions/auth-helpers', () => ({ ensureAdmin: mocks.ensureAdmin }));
vi.mock('@/db/db', () => ({ db: { select: mocks.select, update: mocks.update } }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { getConsentAdminSettings, saveConsentAdminSettings } from '../consent-admin';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
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
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rejects non-admins even if the gate is on', async () => {
    mocks.ensureAdmin.mockRejectedValue(new Error('Access denied'));
    expect((await getConsentAdminSettings('guild-1')).type).toBe('failure');
    expect((await saveConsentAdminSettings('guild-1', true, '')).type).toBe('failure');
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('allows an admin to configure consent while the guild setting is still off', async () => {
    const where = vi.fn().mockResolvedValue([{ enabled: false, guidance: null }]);
    mocks.select.mockReturnValue({ from: () => ({ where }) });
    expect(await getConsentAdminSettings('guild-1')).toEqual({
      type: 'success',
      data: { enabled: false, guidance: null },
    });

    const set = vi.fn().mockReturnValue({
      where: () => ({ returning: () => Promise.resolve([{ id: 'guild-1' }]) }),
    });
    mocks.update.mockReturnValue({ set });
    expect(await saveConsentAdminSettings('guild-1', true, '  Custom guidance  ')).toEqual({
      type: 'success',
      data: { enabled: true },
    });
    expect(set).toHaveBeenCalledWith({ consentEnabled: true, consentGuidance: 'Custom guidance' });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/g/guild-1/admin');
  });

  it('rejects malformed input instead of writing it', async () => {
    expect((await saveConsentAdminSettings('guild-1', 'true' as never, '')).type).toBe('failure');
    expect((await saveConsentAdminSettings('guild-1', true, 'a'.repeat(10001))).type).toBe(
      'failure',
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
