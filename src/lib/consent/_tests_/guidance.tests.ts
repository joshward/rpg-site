import { describe, expect, it } from 'vitest';
import { DEFAULT_CONSENT_GUIDANCE, getConsentGuidance } from '../guidance';

describe('guild consent guidance', () => {
  it('uses the default when no override was saved', () => {
    expect(getConsentGuidance(null)).toBe(DEFAULT_CONSENT_GUIDANCE);
    expect(getConsentGuidance('   ')).toBe(DEFAULT_CONSENT_GUIDANCE);
    expect(DEFAULT_CONSENT_GUIDANCE).toContain('change your answers at any time');
    expect(DEFAULT_CONSENT_GUIDANCE).toContain('does not replace speaking up');
  });

  it('uses the guild Markdown override when provided', () => {
    expect(getConsentGuidance('# Guild guidance')).toBe('# Guild guidance');
  });
});
