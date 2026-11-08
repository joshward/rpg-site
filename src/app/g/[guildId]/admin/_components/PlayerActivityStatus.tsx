'use client';

import { Popover } from '@base-ui/react/popover';
import { Cross2Icon, InfoCircledIcon } from '@radix-ui/react-icons';
import type { AdminMemberInactivity } from '@/actions/preferences';

const states: Record<string, { label: string; color: string; explanation: string }> = {
  active: {
    label: 'Active',
    color: 'bg-jade-3 text-jade-11 border-jade-7 hover:bg-jade-4',
    explanation:
      'A full submission or protective legacy response in the checked cycles keeps this player active.',
  },
  inactive: {
    label: 'Inactive',
    color: 'bg-ruby-3 text-ruby-11 border-ruby-7 hover:bg-ruby-4',
    explanation:
      'All checked cycles are unanswered. This player qualifies for a downgrade at this cycle’s T−4 cutoff.',
  },
  excluded: {
    label: 'Not participating',
    color: 'bg-sage-3 text-sage-11 border-sage-7 hover:bg-sage-4',
    explanation: 'Desired sessions are zero or not set. This player is not a downgrade candidate.',
  },
  new_player: {
    label: 'New Player',
    color: 'bg-violet-3 text-violet-11 border-violet-7 hover:bg-violet-4',
    explanation:
      'There are not enough countable cycles since this player became eligible. The addition month does not count.',
  },
  uncertain: {
    label: 'Unknown',
    color: 'bg-amber-3 text-amber-11 border-amber-7 hover:bg-amber-4',
    explanation:
      'Membership or access history is incomplete for one or more checked cycles. This is not confirmed inactivity.',
  },
};
const monthStates: Record<string, string> = {
  complete: 'Full submission',
  legacy_response: 'Legacy response (protects)',
  missing: 'No response',
  grace: 'Before first countable month',
  unknown: 'Unknown access history',
};
function formatMonth(month: string | null) {
  if (!month) return 'Never';
  const [year, number] = month.split('-').map(Number);
  return `${new Date(Date.UTC(year, number - 1, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}, ${String(year).slice(-2)}`;
}
function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function PlayerActivityStatus({
  activity,
  displayName,
}: {
  activity: AdminMemberInactivity;
  displayName: string;
}) {
  const state = states[activity.classification] ?? states.uncertain;
  const details = activity.details;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-sage-11">
      <span>Last schedule {formatMonth(activity.lastScheduleMonth)} -</span>
      <Popover.Root>
        <Popover.Trigger
          type="button"
          aria-label={`${state.label} status details for ${displayName}`}
          className={`inline-flex min-h-6 items-center gap-1 rounded-full border px-2 py-0.5 font-medium cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-8 ${state.color}`}
        >
          {state.label}
          <InfoCircledIcon className="size-3" aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={6} align="start" className="z-50">
            <Popover.Popup className="w-80 max-w-[calc(100vw-2rem)] max-h-[min(70vh,28rem)] overflow-y-auto rounded-lg border border-sage-7 bg-sage-2 p-4 text-sm text-sage-12 shadow-lg outline-none">
              <div className="flex items-start justify-between gap-3">
                <Popover.Title className="font-semibold">
                  {displayName} — {state.label}
                </Popover.Title>
                <Popover.Close
                  type="button"
                  aria-label="Close status details"
                  className="min-h-6 min-w-6 rounded p-1 hover:bg-sage-4 focus-visible:outline-2 focus-visible:outline-violet-8"
                >
                  <Cross2Icon aria-hidden="true" />
                </Popover.Close>
              </div>
              <Popover.Description className="mt-2 text-sage-11">
                {state.explanation}
              </Popover.Description>
              {details && (
                <div className="mt-3 space-y-2">
                  <p>Threshold: {details.threshold} unanswered cycles</p>
                  <ul className="space-y-1">
                    {details.months.map((month) => (
                      <li key={month.month}>
                        {formatMonth(month.month)}: {monthStates[month.status] ?? 'Unknown'}
                        {month.status === 'complete' && month.source && ` (${month.source})`}
                        {month.source === 'partial' && ' — partial edit only'}
                      </li>
                    ))}
                  </ul>
                  {details.firstEligibleAt && (
                    <p>
                      Eligibility: {formatDate(details.firstEligibleAt)} —{' '}
                      {details.additionSource === 'schedule_fallback'
                        ? 'guild schedule fallback (assumed)'
                        : 'first observed access'}
                    </p>
                  )}
                  {details.firstCountableMonth && (
                    <p>First countable month: {formatMonth(details.firstCountableMonth)}</p>
                  )}
                  {details.reasons.length > 0 && (
                    <ul className="space-y-1 text-sage-11">
                      {details.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-sage-11">
                    Cycle cutoff: {formatDate(details.cutoff)} (UTC)
                    <br />
                    Snapshot: {formatDate(details.evaluatedAt)} (UTC)
                  </p>
                </div>
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
