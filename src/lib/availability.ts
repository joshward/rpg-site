export interface YearMonth {
  year: number;
  /** 1-indexed (1 = January, 12 = December) */
  month: number;
}

/**
 * Returns the year/month of the next month relative to the given date.
 */
export function getNextMonth(now: Date = new Date()): YearMonth {
  const m = now.getMonth() + 2; // getMonth() is 0-indexed, we want 1-indexed next month
  if (m > 12) {
    return { year: now.getFullYear() + 1, month: m - 12 };
  }
  return { year: now.getFullYear(), month: m };
}

/**
 * Returns the date when the submission window opens for the given target month.
 * Currently hardcoded to 7 days before the 1st of the target month.
 */
export function getSubmissionWindowOpen(target: YearMonth): Date {
  const firstOfMonth = new Date(Date.UTC(target.year, target.month - 1, 1));
  firstOfMonth.setUTCDate(firstOfMonth.getUTCDate() - 7);
  return firstOfMonth;
}

/**
 * Determines the target month a user can currently submit availability for.
 * Returns the year/month if the submission window is open, otherwise null.
 */
export function getAvailableMonth(now: Date = new Date()): YearMonth | null {
  const target = getNextMonth(now);
  const windowOpen = getSubmissionWindowOpen(target);

  return now >= windowOpen ? target : null;
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
