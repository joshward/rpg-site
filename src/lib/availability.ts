export interface YearMonth {
  year: number;
  /** 1-indexed (1 = January, 12 = December) */
  month: number;
}

/**
 * Returns the current date, or the date override from the NOW_OVERRIDE env var.
 * Set NOW_OVERRIDE in .env.local to test with a different date (e.g. "2026-02-20").
 */
export function getNow(): Date {
  const override = process.env.NOW_OVERRIDE;
  if (override) {
    // If it's just YYYY-MM-DD, treat as UTC midnight to ensure consistency across environments
    if (/^\d{4}-\d{2}-\d{2}$/.test(override)) {
      const [y, m, d] = override.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d));
    }
    const parsed = new Date(override);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

/**
 * Returns true if the NOW_OVERRIDE env var is active.
 */
export function isDateOverridden(): boolean {
  return !!process.env.NOW_OVERRIDE;
}

/**
 * Returns the year/month of the next month relative to the given date.
 */
export function getNextMonth(now: Date = getNow()): YearMonth {
  const m = now.getUTCMonth() + 2; // getMonth() is 0-indexed, we want 1-indexed next month
  if (m > 12) {
    return { year: now.getUTCFullYear() + 1, month: m - 12 };
  }
  return { year: now.getUTCFullYear(), month: m };
}

/**
 * Returns the date when the submission window opens for the given target month.
 * Uses an inclusive T-10 calendar-day boundary, so this opens 11 days before
 * the 1st of the target month.
 */
export function getSubmissionWindowOpen(target: YearMonth): Date {
  const firstOfMonth = new Date(Date.UTC(target.year, target.month - 1, 1));
  // Subtract 11 so the date-based boundary aligns with inclusive T-10 messaging.
  firstOfMonth.setUTCDate(firstOfMonth.getUTCDate() - 11);
  return firstOfMonth;
}

/**
 * Returns true when we're inside the T-10 availability window for next month.
 * The function name is retained for compatibility.
 */
export function isLast10DaysOfCurrentMonth(now: Date = getNow()): boolean {
  const nextMonth = getNextMonth(now);
  const windowOpen = getSubmissionWindowOpen(nextMonth);
  return now.getTime() >= windowOpen.getTime();
}

/**
 * Determines the target months a user can currently submit availability for.
 * Returns an array of YearMonth.
 */
export function getEditableMonths(now: Date = getNow()): YearMonth[] {
  return [getCurrentMonth(now), getNextMonth(now)];
}

/**
 * Returns the default month for the availability view.
 * Default to current month until the last 10 days of the current month, then default to next month.
 */
export function getDefaultAvailabilityMonth(now: Date = getNow()): YearMonth {
  if (isLast10DaysOfCurrentMonth(now)) {
    return getNextMonth(now);
  }
  return getCurrentMonth(now);
}

/**
 * Returns the number of days in the given month.
 */
export function getDaysInMonth(year: number, month: number): number {
  // Day 0 of the next month = last day of this month
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Validates that every day number is between 1 and the number of days in the month.
 * Returns an error message if invalid, or null if valid.
 */
export function validateDays(year: number, month: number, days: number[]): string | null {
  const maxDay = getDaysInMonth(year, month);
  for (const day of days) {
    if (!Number.isInteger(day) || day < 1 || day > maxDay) {
      return `Invalid day ${day} for ${year}-${month} (must be 1-${maxDay})`;
    }
  }
  return null;
}

/**
 * Returns the previous month relative to the given year/month.
 */
export function getPrevYearMonth(target: YearMonth): YearMonth {
  if (target.month === 1) {
    return { year: target.year - 1, month: 12 };
  }
  return { year: target.year, month: target.month - 1 };
}

/**
 * Returns the next month relative to the given year/month.
 */
export function getNextYearMonth(target: YearMonth): YearMonth {
  if (target.month === 12) {
    return { year: target.year + 1, month: 1 };
  }
  return { year: target.year, month: target.month + 1 };
}

/**
 * Returns the current calendar month as a YearMonth.
 */
export function getCurrentMonth(now: Date = getNow()): YearMonth {
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/**
 * Returns true if two YearMonth values represent the same month.
 */
export function isSameMonth(a: YearMonth, b: YearMonth): boolean {
  return a.year === b.year && a.month === b.month;
}

/**
 * Returns the day of the week (0=Sun, 6=Sat) for the 1st of the given month.
 */
export function getStartDayOfWeek(target: YearMonth): number {
  return new Date(Date.UTC(target.year, target.month - 1, 1)).getUTCDay();
}

/**
 * Maps days from a previous month to a target month by calendar grid position
 * (same row and column in a Sun-Sat calendar grid).
 *
 * For each day in the target month, finds the day in the previous month that
 * occupies the same weekday in the same calendar week row. Days without a
 * match (due to different start days or month lengths) return null.
 */
export function mapDaysByWeekday<T>(
  prevMonth: YearMonth,
  targetMonth: YearMonth,
  prevDays: Map<number, T>,
): Map<number, T> {
  const prevStart = getStartDayOfWeek(prevMonth);
  const targetStart = getStartDayOfWeek(targetMonth);
  const targetDayCount = getDaysInMonth(targetMonth.year, targetMonth.month);
  const prevDayCount = getDaysInMonth(prevMonth.year, prevMonth.month);

  const result = new Map<number, T>();

  for (let d = 1; d <= targetDayCount; d++) {
    const weekday = (targetStart + d - 1) % 7;
    const row = Math.floor((targetStart + d - 1) / 7);

    // Find the corresponding day in the previous month: same weekday, same row
    const prevDay = weekday - prevStart + 1 + 7 * row;

    if (prevDay >= 1 && prevDay <= prevDayCount) {
      const value = prevDays.get(prevDay);
      if (value !== undefined) {
        result.set(d, value);
      }
    }
  }

  return result;
}

/**
 * Formats a year/month as a human-readable string (e.g. "July 2026").
 */
export function formatMonthYear(target: YearMonth): string {
  const date = new Date(Date.UTC(target.year, target.month - 1, 1));
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
