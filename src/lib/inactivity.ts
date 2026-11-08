export const DEFAULT_INACTIVITY_THRESHOLD = 3;
export function validThreshold(value: number) {
  return Number.isInteger(value) && value >= 2 && value <= 12;
}

export function monthIndex(date: Date) {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}
export function monthLabel(index: number) {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}
export function parseMonth(value: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return NaN;
  const [year, month] = value.split('-').map(Number);
  return year * 12 + month - 1;
}

export interface MemberTracking {
  guildId: string;
  discordUserId: string;
  firstEligibleAt: Date;
  additionSource: 'schedule_fallback' | 'first_observed';
  firstObservedAt: Date;
  lastObservedAt: Date;
  hasAccess: boolean;
  accessSince: Date;
  discordJoinedAt: string | null;
}
export interface MembershipObservation {
  discordUserId: string;
  eligible: boolean;
  joinedAt: string | null;
}

// Only the first successful, complete guild census can assign the schedule fallback.
// Later discoveries never inherit it, even if they never log in or set preferences.
export function planMembershipTracking({
  guildId,
  observedAt,
  initialized,
  scheduleFallbackAt,
  existing,
  members,
}: {
  guildId: string;
  observedAt: Date;
  initialized: boolean;
  scheduleFallbackAt: Date | null;
  existing: MemberTracking[];
  members: MembershipObservation[];
}): MemberTracking[] {
  const byId = new Map(members.map((m) => [m.discordUserId, m]));
  const previous = new Map(
    existing.filter((m) => m.guildId === guildId).map((m) => [m.discordUserId, m]),
  );
  const result: MemberTracking[] = [];
  for (const id of new Set([...byId.keys(), ...previous.keys()])) {
    const observation = byId.get(id);
    const old = previous.get(id);
    const eligible = observation?.eligible === true;
    if (!old && !eligible) continue;
    if (old) {
      const rejoined = eligible && old.discordJoinedAt !== (observation?.joinedAt ?? null);
      // After an observation outage we cannot assert uninterrupted access. Retain
      // original addition, but conservatively bound the reliable access interval.
      const gap = observedAt.getTime() - old.lastObservedAt.getTime() > 3 * 86400000;
      result.push({
        ...old,
        hasAccess: eligible,
        lastObservedAt: observedAt,
        accessSince: eligible && (!old.hasAccess || rejoined || gap) ? observedAt : old.accessSince,
        discordJoinedAt: observation?.joinedAt ?? old.discordJoinedAt,
      });
    } else {
      const fallback =
        !initialized && scheduleFallbackAt && scheduleFallbackAt <= observedAt
          ? scheduleFallbackAt
          : null;
      const firstEligibleAt = fallback ?? observedAt;
      result.push({
        guildId,
        discordUserId: id,
        firstEligibleAt,
        additionSource: fallback ? 'schedule_fallback' : 'first_observed',
        firstObservedAt: observedAt,
        lastObservedAt: observedAt,
        hasAccess: true,
        accessSince: firstEligibleAt,
        discordJoinedAt: observation?.joinedAt ?? null,
      });
    }
  }
  return result;
}

export interface CompletionEvidence {
  guildId: string;
  discordUserId: string;
  year: number;
  month: number;
  completedAt: Date | null;
  completionSource: string | null;
}

export function lastSubmittedMonth(
  guildId: string,
  discordUserId: string,
  submissions: CompletionEvidence[],
) {
  const months = submissions
    .filter(
      (s) =>
        s.guildId === guildId &&
        s.discordUserId === discordUserId &&
        ((s.completedAt && ['player', 'admin'].includes(s.completionSource ?? '')) ||
          s.completionSource !== 'partial'),
    )
    .map((s) => s.year * 12 + s.month - 1);
  return months.length ? monthLabel(Math.max(...months)) : null;
}

export function evaluateInactivity({
  guildId,
  discordUserId,
  now,
  threshold,
  sessionsPerMonth,
  bot,
  access,
  joinedAt,
  tracking,
  submissions,
}: {
  guildId: string;
  discordUserId: string;
  now: Date;
  threshold: number;
  sessionsPerMonth: number | null;
  bot: boolean;
  access: boolean;
  joinedAt: string | null;
  tracking?: MemberTracking;
  submissions: CompletionEvidence[];
}) {
  if (!validThreshold(threshold)) throw new Error('Invalid unanswered-cycle threshold');
  const target = monthIndex(now) + 1;
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, -4));
  const ownTracking =
    tracking?.guildId === guildId && tracking.discordUserId === discordUserId
      ? tracking
      : undefined;
  const firstCountable = ownTracking ? monthIndex(ownTracking.firstEligibleAt) + 1 : null;
  const currentMembership =
    ownTracking && ownTracking.hasAccess && joinedAt && joinedAt === ownTracking.discordJoinedAt;
  const accessStart =
    ownTracking && joinedAt
      ? Math.max(monthIndex(ownTracking.accessSince) + 1, monthIndex(new Date(joinedAt)) + 1)
      : Infinity;
  const months = Array.from({ length: threshold }, (_, i) => target - threshold + 1 + i).map(
    (index) => {
      const submission = submissions.find(
        (s) =>
          s.guildId === guildId &&
          s.discordUserId === discordUserId &&
          s.year * 12 + s.month - 1 === index,
      );
      let status: 'complete' | 'legacy_response' | 'missing' | 'unknown' | 'grace';
      if (
        submission?.completedAt &&
        ['player', 'admin'].includes(submission.completionSource ?? '')
      )
        status = 'complete';
      // Only explicit partial provenance can rule out legacy completion. In
      // particular, an older deployed app can still write rows during rollout.
      else if (submission && submission.completionSource !== 'partial') status = 'legacy_response';
      else if (firstCountable !== null && index < firstCountable) status = 'grace';
      else if (currentMembership && index >= accessStart) status = 'missing';
      else status = 'unknown';
      return {
        month: monthLabel(index),
        status,
        source: submission?.completionSource ?? null,
        completedAt: submission?.completedAt?.toISOString() ?? null,
      };
    },
  );
  const reasons: string[] = [];
  if (bot) reasons.push('Bot');
  if (!access) reasons.push('No current guild access');
  if (sessionsPerMonth === null) reasons.push('Desired sessions not configured');
  else if (sessionsPerMonth === 0) reasons.push('Already zero');
  if (!ownTracking) reasons.push('No recorded eligible membership yet');
  else if (!currentMembership)
    reasons.push('Current membership could not be verified against tracking');
  if (months.some((m) => m.status === 'complete'))
    reasons.push('Full submission in the checked cycles');
  if (months.some((m) => m.status === 'legacy_response'))
    reasons.push(
      'Legacy submission conservatively counts as activity; full completion is not claimed',
    );
  if (months.some((m) => m.status === 'grace'))
    reasons.push('Addition month exempt: not enough countable cycles');
  if (months.some((m) => m.status === 'unknown'))
    reasons.push('Unknown access history, rejoin, or observation gap in the checked cycles');
  const wouldPause = reasons.length === 0;
  const excluded = bot || !access || sessionsPerMonth === null || sessionsPerMonth === 0;
  const active = months.some((m) => m.status === 'complete' || m.status === 'legacy_response');
  const classification = excluded
    ? 'excluded'
    : wouldPause
      ? 'inactive'
      : active
        ? 'active'
        : months.some((m) => m.status === 'grace')
          ? 'new_player'
          : 'uncertain';
  return {
    wouldPause,
    classification,
    atCutoff: now.getUTCDate() === cutoff.getUTCDate(),
    cutoff: cutoff.toISOString(),
    target: monthLabel(target),
    firstCountableMonth: firstCountable === null ? null : monthLabel(firstCountable),
    months,
    reasons,
    automationEnabled: false as const,
  };
}
