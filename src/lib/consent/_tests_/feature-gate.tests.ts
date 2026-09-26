import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canAccessGameConsent,
  canAccessGuildConsent,
  isConsentFeatureEnabled,
} from '../feature-gate';

afterEach(() => vi.unstubAllEnvs());

describe('consent feature gate', () => {
  it('defaults to off and rejects ambiguous values', () => {
    vi.stubEnv('CONSENT_FEATURE_ENABLED', undefined);
    expect(isConsentFeatureEnabled()).toBe(false);
    vi.stubEnv('CONSENT_FEATURE_ENABLED', '');
    expect(isConsentFeatureEnabled()).toBe(false);
    expect(canAccessGuildConsent(true)).toBe(false);
    expect(canAccessGameConsent(true, 'requested')).toBe(false);

    vi.stubEnv('CONSENT_FEATURE_ENABLED', '1');
    expect(isConsentFeatureEnabled()).toBe(false);
    vi.stubEnv('CONSENT_FEATURE_ENABLED', 'TRUE');
    expect(isConsentFeatureEnabled()).toBe(false);
  });

  it('requires the global and guild toggles for a guild checklist', () => {
    vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
    expect(canAccessGuildConsent(false)).toBe(false);
    expect(canAccessGuildConsent(true)).toBe(true);
  });

  it('requires an enabled game for game-level access', () => {
    vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
    expect(canAccessGameConsent(false, 'optional')).toBe(false);
    expect(canAccessGameConsent(true, 'off')).toBe(false);
    expect(canAccessGameConsent(true, 'optional')).toBe(true);
    expect(canAccessGameConsent(true, 'requested')).toBe(true);
    expect(canAccessGameConsent(true, undefined as never)).toBe(false);
  });
});
