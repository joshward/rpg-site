import { describe, expect, it } from 'vitest';
import { joinUrl } from '../urls';

describe('joinUrl', () => {
  it('joins base and one part', () => {
    expect(joinUrl('https://example.com', 'g')).toBe('https://example.com/g');
  });

  it('handles trailing slash in base', () => {
    expect(joinUrl('https://example.com/', 'g')).toBe('https://example.com/g');
  });

  it('handles leading slash in part', () => {
    expect(joinUrl('https://example.com', '/g')).toBe('https://example.com/g');
  });

  it('handles both slashes', () => {
    expect(joinUrl('https://example.com/', '/g')).toBe('https://example.com/g');
  });

  it('joins multiple parts', () => {
    expect(joinUrl('https://example.com', 'g', '123', 'availability')).toBe(
      'https://example.com/g/123/availability',
    );
  });

  it('handles slashes in middle parts', () => {
    expect(joinUrl('https://example.com/', '/g/', '/123/', '/availability')).toBe(
      'https://example.com/g/123/availability',
    );
  });

  it('preserves trailing slash in last part', () => {
    expect(joinUrl('https://example.com', 'g/')).toBe('https://example.com/g/');
    expect(joinUrl('https://example.com', 'g', '123/')).toBe('https://example.com/g/123/');
  });

  it('handles empty parts', () => {
    expect(joinUrl('https://example.com', '', '/g', null, undefined, '123')).toBe(
      'https://example.com/g/123',
    );
  });

  it('preserves absolute URLs when base is empty', () => {
    expect(joinUrl('', 'https://example.com/', '/g')).toBe('https://example.com/g');
  });

  it('handles query parameters (as part of last segment)', () => {
    expect(joinUrl('https://example.com', 'g?id=123')).toBe('https://example.com/g?id=123');
  });

  it('handles complex scenario from issue', () => {
    const siteUrl = 'https://tavern-master.joshward.dev/';
    const guildId = '973027674396180580';
    expect(joinUrl(siteUrl, '/g/', guildId)).toBe(
      'https://tavern-master.joshward.dev/g/973027674396180580',
    );
  });
});
