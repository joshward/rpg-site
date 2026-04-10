import { describe, expect, it } from 'vitest';
import {
  mapDaysByWeekday,
  getStartDayOfWeek,
  getDaysInMonth,
  getPrevYearMonth,
  getNextYearMonth,
  isLast10DaysOfCurrentMonth,
  getEditableMonths,
  getDefaultAvailabilityMonth,
  type YearMonth,
} from '../availability';

describe('Availability Helpers', () => {
  describe('getStartDayOfWeek', () => {
    it('returns correct day for known dates', () => {
      // March 2026 starts on Sunday (0)
      expect(getStartDayOfWeek({ year: 2026, month: 3 })).toBe(0);
      // February 2026 starts on Sunday (0)
      expect(getStartDayOfWeek({ year: 2026, month: 2 })).toBe(0);
      // April 2026 starts on Wednesday (3)
      expect(getStartDayOfWeek({ year: 2026, month: 4 })).toBe(3);
      // January 2026 starts on Thursday (4)
      expect(getStartDayOfWeek({ year: 2026, month: 1 })).toBe(4);
    });
  });

  describe('mapDaysByWeekday', () => {
    function makeStatusMap(statuses: Record<number, string>): Map<number, string> {
      return new Map(Object.entries(statuses).map(([k, v]) => [Number(k), v]));
    }

    it('copies same-structure months 1-to-1 when start days match', () => {
      // Feb 2026 and Mar 2026 both start on Sunday
      const prev: YearMonth = { year: 2026, month: 2 };
      const target: YearMonth = { year: 2026, month: 3 };

      expect(getStartDayOfWeek(prev)).toBe(0);
      expect(getStartDayOfWeek(target)).toBe(0);

      const prevDays = makeStatusMap({ 1: 'available', 7: 'late', 14: 'unavailable' });
      const result = mapDaysByWeekday(prev, target, prevDays);

      // Same grid position: day 1 → day 1, day 7 → day 7, day 14 → day 14
      expect(result.get(1)).toBe('available');
      expect(result.get(7)).toBe('late');
      expect(result.get(14)).toBe('unavailable');
    });

    it('leaves early days unset when target starts earlier in the week', () => {
      // Prev starts Wed (3), target starts Mon (1)
      // Apr 2026 starts Wed, use a constructed example
      const prev: YearMonth = { year: 2026, month: 4 }; // starts Wed
      // Find a month starting on Mon — Sep 2026 starts Tue, not great
      // Let's just verify the algorithm with known start days
      const prevStart = getStartDayOfWeek(prev);
      expect(prevStart).toBe(3); // Wednesday

      // June 2026 starts on Monday
      const target: YearMonth = { year: 2026, month: 6 };
      const targetStart = getStartDayOfWeek(target);
      expect(targetStart).toBe(1); // Monday

      // Prev day 1 is Wed in row 0. Target day 1 is Mon in row 0.
      // Target Mon (day 1) and Tue (day 2) have no prev match in row 0
      const prevDays = makeStatusMap({
        1: 'available', // Wed, row 0
        2: 'late', // Thu, row 0
        6: 'if_needed', // Mon, row 1
      });

      const result = mapDaysByWeekday(prev, target, prevDays);

      // Target day 1 (Mon, row 0): prev row 0 Mon = day (1 - 3 + 1 + 0) = -1 → no match
      expect(result.has(1)).toBe(false);
      // Target day 2 (Tue, row 0): prev row 0 Tue = day (2 - 3 + 1 + 0) = 0 → no match
      expect(result.has(2)).toBe(false);
      // Target day 3 (Wed, row 0): prev row 0 Wed = day (3 - 3 + 1 + 0) = 1 → available
      expect(result.get(3)).toBe('available');
      // Target day 4 (Thu, row 0): prev row 0 Thu = day (4 - 3 + 1 + 0) = 2 → late
      expect(result.get(4)).toBe('late');
      // Target day 8 (Mon, row 1): prev row 1 Mon = day (1 - 3 + 1 + 7) = 6 → if_needed
      expect(result.get(8)).toBe('if_needed');
    });

    it('ignores extra prev days when target starts later in the week', () => {
      // Prev starts Mon (1), target starts Wed (3)
      // June 2026 starts Mon, April 2026 starts Wed
      const prev: YearMonth = { year: 2026, month: 6 }; // Mon
      const target: YearMonth = { year: 2026, month: 4 }; // Wed

      const prevDays = makeStatusMap({
        1: 'available', // Mon, row 0
        2: 'late', // Tue, row 0
        3: 'if_needed', // Wed, row 0
      });

      const result = mapDaysByWeekday(prev, target, prevDays);

      // Target day 1 (Wed, row 0): prev row 0 Wed = day (3 - 1 + 1 + 0) = 3 → if_needed
      expect(result.get(1)).toBe('if_needed');
      // Prev Mon (day 1) and Tue (day 2) have no target match in row 0
    });

    it('handles months with different lengths', () => {
      // Feb 2026 has 28 days, Mar 2026 has 31 days, both start Sunday
      const prev: YearMonth = { year: 2026, month: 2 };
      const target: YearMonth = { year: 2026, month: 3 };

      expect(getDaysInMonth(2026, 2)).toBe(28);
      expect(getDaysInMonth(2026, 3)).toBe(31);

      // Fill all 28 days of Feb
      const prevDays = makeStatusMap(
        Object.fromEntries(Array.from({ length: 28 }, (_, i) => [i + 1, 'available'])),
      );

      const result = mapDaysByWeekday(prev, target, prevDays);

      // Days 1-28 should all map (same start day)
      for (let d = 1; d <= 28; d++) {
        expect(result.get(d)).toBe('available');
      }
      // Days 29-31 have no match (Feb only has 28 days, row 4 doesn't exist in Feb)
      expect(result.has(29)).toBe(false);
      expect(result.has(30)).toBe(false);
      expect(result.has(31)).toBe(false);
    });

    it('returns empty map when prev has no data', () => {
      const prev: YearMonth = { year: 2026, month: 2 };
      const target: YearMonth = { year: 2026, month: 3 };

      const result = mapDaysByWeekday(prev, target, new Map());
      expect(result.size).toBe(0);
    });
  });

  describe('getPrevYearMonth / getNextYearMonth', () => {
    it('handles year boundaries', () => {
      expect(getPrevYearMonth({ year: 2026, month: 1 })).toEqual({ year: 2025, month: 12 });
      expect(getNextYearMonth({ year: 2025, month: 12 })).toEqual({ year: 2026, month: 1 });
    });

    it('handles normal months', () => {
      expect(getPrevYearMonth({ year: 2026, month: 6 })).toEqual({ year: 2026, month: 5 });
      expect(getNextYearMonth({ year: 2026, month: 6 })).toEqual({ year: 2026, month: 7 });
    });
  });

  describe('Availability Window Helpers', () => {
    describe('isLast10DaysOfCurrentMonth', () => {
      it('returns false for early in the month', () => {
        const now = new Date('2026-03-15');
        expect(isLast10DaysOfCurrentMonth(now)).toBe(false);
      });

      it('returns true for last 10 days of the month', () => {
        const now = new Date('2026-03-22');
        expect(isLast10DaysOfCurrentMonth(now)).toBe(true);
      });

      it('returns true for the exact boundary (10 days before next month)', () => {
        const now = new Date('2026-03-22T00:00:00Z');
        expect(isLast10DaysOfCurrentMonth(now)).toBe(true);
      });
    });

    describe('getDefaultAvailabilityMonth', () => {
      it('returns current month early in the month', () => {
        const now = new Date('2026-03-15');
        expect(getDefaultAvailabilityMonth(now)).toEqual({ year: 2026, month: 3 });
      });

      it('returns next month late in the month', () => {
        const now = new Date('2026-03-22');
        expect(getDefaultAvailabilityMonth(now)).toEqual({ year: 2026, month: 4 });
      });
    });

    describe('getEditableMonths', () => {
      it('returns current and next month', () => {
        const now = new Date('2026-03-15');
        const editable = getEditableMonths(now);
        expect(editable).toHaveLength(2);
        expect(editable).toContainEqual({ year: 2026, month: 3 });
        expect(editable).toContainEqual({ year: 2026, month: 4 });
      });
    });
  });
});
