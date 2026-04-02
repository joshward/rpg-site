export type AvailabilityStatus = 'available' | 'if_needed' | 'late' | 'unavailable' | null;

export interface ScorableMember {
  isRequired: boolean;
  availability: Record<number, AvailabilityStatus>;
}

/**
 * Calculates the optimal days for a game to be scheduled based on member availability.
 *
 * Ranking philosophy:
 * 1. Days where any required member is unavailable are invalid.
 * 2. Days that do not meet the minimum viable attendance are weaker fallback options.
 * 3. Among viable days, prefer stronger total turnout first.
 * 4. Then prefer less disruption for required members.
 * 5. Then prefer stronger optional turnout.
 *
 * Notes:
 * - `null` is treated the same as `unavailable`.
 * - The minimum viable attendance is currently `min(3, members.length)`.
 *   This is intended as a reasonable first-pass default and can be made configurable later.
 * - The function returns at least `sessionsNeeded` days when possible.
 * - It may return more than `sessionsNeeded` when additional days are effectively tied
 *   with the last selected day.
 * - If there are not enough viable days, the function will include valid-but-non-viable
 *   fallback days before giving up.
 *
 * @param sessionsNeeded - The number of sessions the game aims to have per month.
 * @param members - The members of the game and their availability.
 * @param days - The list of days in the month to consider.
 * @param excludedDays - Days that are already taken by other games and should not be considered.
 * @returns A set of day numbers that are considered optimal.
 */
export function getOptimalDays(
  sessionsNeeded: number,
  members: ScorableMember[],
  days: number[],
  excludedDays: Set<number>,
): Set<number> {
  if (sessionsNeeded <= 0 || members.length === 0 || days.length === 0) {
    return new Set<number>();
  }

  const minimumViableAttendees = Math.min(3, members.length);

  const uniqueCandidateDays = [...new Set(days)].filter((day) => !excludedDays.has(day));

  const scoredDays = uniqueCandidateDays
    .map((day) => scoreDay(day, members, minimumViableAttendees))
    .sort(compareDayScores);

  if (scoredDays.length === 0) {
    return new Set<number>();
  }

  const selected: DayScore[] = [];
  const selectedDays = new Set<number>();

  const viableDays = scoredDays.filter((day) => day.isViable);
  const fallbackDays = scoredDays.filter((day) => day.isValid && !day.isViable);

  // First, take the best viable days.
  for (const day of viableDays) {
    if (selected.length < sessionsNeeded) {
      selected.push(day);
      selectedDays.add(day.day);
      continue;
    }

    const cutoff = selected[selected.length - 1];
    if (isEffectivelyTied(day, cutoff)) {
      selected.push(day);
      selectedDays.add(day.day);
      continue;
    }

    break;
  }

  // If we still do not have enough, include best valid-but-non-viable fallback days.
  for (const day of fallbackDays) {
    if (selectedDays.has(day.day)) {
      continue;
    }

    if (selected.length < sessionsNeeded) {
      selected.push(day);
      selectedDays.add(day.day);
      continue;
    }

    const cutoff = selected[selected.length - 1];
    if (isEffectivelyTied(day, cutoff)) {
      selected.push(day);
      selectedDays.add(day.day);
      continue;
    }

    break;
  }

  return new Set(selected.map((day) => day.day));
}

interface DayScore {
  day: number;

  requiredAvailable: number;
  requiredIfNeeded: number;
  requiredLate: number;
  requiredUnavailable: number;

  optionalAvailable: number;
  optionalIfNeeded: number;
  optionalLate: number;
  optionalUnavailable: number;

  strongAttendees: number; // available + if_needed
  possibleAttendees: number; // available + if_needed + late

  isValid: boolean;
  isViable: boolean;
}

function scoreDay(
  day: number,
  members: ScorableMember[],
  minimumViableAttendees: number,
): DayScore {
  let requiredAvailable = 0;
  let requiredIfNeeded = 0;
  let requiredLate = 0;
  let requiredUnavailable = 0;

  let optionalAvailable = 0;
  let optionalIfNeeded = 0;
  let optionalLate = 0;
  let optionalUnavailable = 0;

  for (const member of members) {
    const normalizedStatus = normalizeStatus(member.availability[day]);

    if (member.isRequired) {
      switch (normalizedStatus) {
        case 'available':
          requiredAvailable += 1;
          break;
        case 'if_needed':
          requiredIfNeeded += 1;
          break;
        case 'late':
          requiredLate += 1;
          break;
        case 'unavailable':
          requiredUnavailable += 1;
          break;
      }
    } else {
      switch (normalizedStatus) {
        case 'available':
          optionalAvailable += 1;
          break;
        case 'if_needed':
          optionalIfNeeded += 1;
          break;
        case 'late':
          optionalLate += 1;
          break;
        case 'unavailable':
          optionalUnavailable += 1;
          break;
      }
    }
  }

  const strongAttendees =
    requiredAvailable + requiredIfNeeded + optionalAvailable + optionalIfNeeded;

  const possibleAttendees = strongAttendees + requiredLate + optionalLate;

  const isValid = requiredUnavailable === 0;
  const isViable = isValid && possibleAttendees >= minimumViableAttendees;

  return {
    day,

    requiredAvailable,
    requiredIfNeeded,
    requiredLate,
    requiredUnavailable,

    optionalAvailable,
    optionalIfNeeded,
    optionalLate,
    optionalUnavailable,

    strongAttendees,
    possibleAttendees,

    isValid,
    isViable,
  };
}

function normalizeStatus(status: AvailabilityStatus): Exclude<AvailabilityStatus, null> {
  return status ?? 'unavailable';
}

function compareDayScores(a: DayScore, b: DayScore): number {
  // 1. Valid days first.
  if (a.isValid !== b.isValid) {
    return a.isValid ? -1 : 1;
  }

  // 2. Viable days first.
  if (a.isViable !== b.isViable) {
    return a.isViable ? -1 : 1;
  }

  // 3. Prefer stronger likely turnout.
  if (a.strongAttendees !== b.strongAttendees) {
    return b.strongAttendees - a.strongAttendees;
  }

  // 4. Prefer stronger total possible turnout, including late attendees.
  if (a.possibleAttendees !== b.possibleAttendees) {
    return b.possibleAttendees - a.possibleAttendees;
  }

  // 5. Fewer required-late members is better.
  if (a.requiredLate !== b.requiredLate) {
    return a.requiredLate - b.requiredLate;
  }

  // 6. More required-available members is better.
  if (a.requiredAvailable !== b.requiredAvailable) {
    return b.requiredAvailable - a.requiredAvailable;
  }

  // 7. More optional reach is better.
  const aOptionalReach = a.optionalAvailable + a.optionalIfNeeded;
  const bOptionalReach = b.optionalAvailable + b.optionalIfNeeded;
  if (aOptionalReach !== bOptionalReach) {
    return bOptionalReach - aOptionalReach;
  }

  // 8. More fully available optional members is better.
  if (a.optionalAvailable !== b.optionalAvailable) {
    return b.optionalAvailable - a.optionalAvailable;
  }

  // 9. Fewer optional-late members is better.
  if (a.optionalLate !== b.optionalLate) {
    return a.optionalLate - b.optionalLate;
  }

  // 10. Fewer required-if-needed members is slightly cleaner,
  // though this usually already follows from earlier comparisons.
  if (a.requiredIfNeeded !== b.requiredIfNeeded) {
    return a.requiredIfNeeded - b.requiredIfNeeded;
  }

  // 11. Stable final tie-breaker: earlier day first.
  return a.day - b.day;
}

function isEffectivelyTied(a: DayScore, b: DayScore): boolean {
  return (
    a.isValid === b.isValid &&
    a.isViable === b.isViable &&
    a.strongAttendees === b.strongAttendees &&
    a.possibleAttendees === b.possibleAttendees &&
    a.requiredLate === b.requiredLate &&
    a.requiredAvailable === b.requiredAvailable &&
    a.requiredIfNeeded === b.requiredIfNeeded &&
    a.optionalAvailable === b.optionalAvailable &&
    a.optionalIfNeeded === b.optionalIfNeeded &&
    a.optionalLate === b.optionalLate
  );
}
