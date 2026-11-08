import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNow, isDateOverridden } from '../availability';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('testing clock configuration', () => {
  it('uses the real clock and disables the indicator for underscore-prefixed values', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-06T12:00:00Z'));
    vi.stubEnv('NOW_OVERRIDE', '_2026-05-24');
    expect(getNow().toISOString()).toBe('2026-11-06T12:00:00.000Z');
    expect(isDateOverridden()).toBe(false);
  });
  it('restores the saved UTC testing date when the underscore is removed', () => {
    vi.stubEnv('NOW_OVERRIDE', '2026-05-24');
    expect(getNow().toISOString()).toBe('2026-05-24T00:00:00.000Z');
    expect(isDateOverridden()).toBe(true);
  });
});
