export interface PlayerInactivityPause {
  pausedAt: string;
}

export interface AdminInactivityPause extends PlayerInactivityPause {
  previousSessionsPerMonth: number;
  threshold: number;
  checkedMonths: string[];
  dmStatus: 'reserved' | 'sent' | 'failed' | 'blocked';
  current: boolean;
}

// Audit JSON is not a client DTO. Only expose the target-month labels here,
// never the membership/join/access observations stored alongside them.
export function checkedPauseMonths(evidence: unknown): string[] {
  if (
    !evidence ||
    typeof evidence !== 'object' ||
    !('months' in evidence) ||
    !Array.isArray(evidence.months)
  )
    return [];
  return evidence.months.flatMap((row: unknown) =>
    row &&
    typeof row === 'object' &&
    'month' in row &&
    typeof row.month === 'string' &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(row.month)
      ? [row.month]
      : [],
  );
}
