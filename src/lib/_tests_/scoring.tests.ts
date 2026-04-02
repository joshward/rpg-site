import { describe, it, expect } from 'vitest';
import { getOptimalDays, ScorableMember } from '../scoring';

describe('getOptimalDays', () => {
  it('should return an empty set if sessionsNeeded is 0', () => {
    const members: ScorableMember[] = [{ isRequired: true, availability: { 1: 'available' } }];
    const result = getOptimalDays(0, members, [1], new Set());
    expect(result.size).toBe(0);
  });

  it('should return an empty set if no members', () => {
    const result = getOptimalDays(1, [], [1], new Set());
    expect(result.size).toBe(0);
  });

  it('should exclude days in excludedDays', () => {
    const members: ScorableMember[] = [
      { isRequired: true, availability: { 1: 'available', 2: 'available' } },
    ];
    const result = getOptimalDays(1, members, [1, 2], new Set([1]));
    expect(result.has(1)).toBe(false);
    expect(result.has(2)).toBe(true);
  });

  it('should invalidate days where a required member is unavailable', () => {
    const members: ScorableMember[] = [
      { isRequired: true, availability: { 1: 'unavailable', 2: 'available' } },
    ];
    const result = getOptimalDays(1, members, [1, 2], new Set());
    expect(result.has(1)).toBe(false);
    expect(result.has(2)).toBe(true);
  });

  it('should treat null/undefined as unavailable for required members', () => {
    const members: ScorableMember[] = [
      { isRequired: true, availability: { 1: undefined, 2: 'available' } },
    ];
    const result = getOptimalDays(1, members, [1, 2], new Set());
    expect(result.has(1)).toBe(false);
    expect(result.has(2)).toBe(true);
  });

  it('should prioritize days with better turnout', () => {
    const members: ScorableMember[] = [
      { isRequired: true, availability: { 1: 'available', 2: 'available' } },
      { isRequired: false, availability: { 1: 'available', 2: 'unavailable' } },
    ];
    // Day 1 has 2 available, Day 2 has 1 available
    const result = getOptimalDays(1, members, [1, 2], new Set());
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(false);
  });

  it('should handle ties by returning both if needed to meet sessionsNeeded', () => {
    const members: ScorableMember[] = [
      { isRequired: true, availability: { 1: 'available', 2: 'available', 3: 'unavailable' } },
    ];
    const result = getOptimalDays(2, members, [1, 2, 3], new Set());
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(true);
    expect(result.size).toBe(2);
  });

  it('should return more than sessionsNeeded if there is an exact tie', () => {
    const members: ScorableMember[] = [
      { isRequired: true, availability: { 1: 'available', 2: 'available' } },
    ];
    // We need 1 session, but 1 and 2 are exactly the same
    const result = getOptimalDays(1, members, [1, 2], new Set());
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(true);
    expect(result.size).toBe(2);
  });

  it('should fall back to valid but non-viable days if not enough viable days exist', () => {
    // Viable means >= 3 attendees (or members.length if less than 3)
    // Here we have 4 members, so viable means >= 3 attendees.
    const members: ScorableMember[] = [
      { isRequired: true, availability: { 1: 'available', 2: 'available' } },
      { isRequired: false, availability: { 1: 'unavailable', 2: 'unavailable' } },
      { isRequired: false, availability: { 1: 'unavailable', 2: 'unavailable' } },
      { isRequired: false, availability: { 1: 'unavailable', 2: 'unavailable' } },
    ];
    // Day 1 and 2 only have 1 attendee. Not viable but valid.
    const result = getOptimalDays(1, members, [1, 2], new Set());
    expect(result.size).toBe(2); // Both are tied
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(true);
  });

  it('should handle "if_needed" and "late" status weights correctly', () => {
    const members: ScorableMember[] = [
      { isRequired: true, availability: { 1: 'available', 2: 'if_needed', 3: 'late' } },
    ];
    // Score ranking: 1 (available) > 2 (if_needed) > 3 (late)
    const result = getOptimalDays(1, members, [1, 2, 3], new Set());
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(false);
    expect(result.has(3)).toBe(false);
  });
});
