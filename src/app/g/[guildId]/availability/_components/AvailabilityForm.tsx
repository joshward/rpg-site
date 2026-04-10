'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useForm } from '@tanstack/react-form';
import { twMerge } from 'tailwind-merge';
import { usePlausible } from 'next-plausible';
import Button from '@/components/Button';
import Paper from '@/components/Paper';
import Link from '@/components/Link';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useNotification } from '@/components/Notification';
import {
  submitAvailability,
  adminSubmitMemberAvailability,
  type AvailabilityStatus,
} from '@/actions/availability';
import { isMonthScheduled } from '@/actions/games';
import { isFailure } from '@/actions/result';
import {
  getDaysInMonth,
  getPrevYearMonth,
  mapDaysByWeekday,
  formatMonthYear,
  type YearMonth,
} from '@/lib/availability';
import { getContactInfo } from '../../helpers';
import { STATUS_OPTIONS, UNSET_OPTION } from './availability-status';
import {
  DefaultTransitionStyles,
  FocusResetStyles,
  ShowFocusOnKeyboardStyles,
} from '@/styles/common';
import type { PlausibleEvents } from '@/lib/plausible-events';

interface AvailabilityFormProps {
  target: YearMonth;
  /** Pre-populate the form when editing an existing submission */
  initialDays?: { day: number; status: AvailabilityStatus }[];
  /** Previous month's submitted days, used for the copy feature */
  previousMonthDays?: { day: number; status: AvailabilityStatus }[];
  onSubmitted?: () => void;
  userId?: string;
  guildInfo?: {
    supportChannelId?: string;
    supportChannelName?: string;
    adminContactInfo?: string;
  };
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

type DayStatus = AvailabilityStatus | null;
type DayEntry = { day: number; status: DayStatus };

function buildDefaultDays(year: number, month: number): DayEntry[] {
  const count = getDaysInMonth(year, month);
  return Array.from({ length: count }, (_, i) => ({
    day: i + 1,
    status: null,
  }));
}

export default function AvailabilityForm({
  target,
  initialDays,
  previousMonthDays,
  onSubmitted,
  userId,
  guildInfo,
}: AvailabilityFormProps) {
  const { guildId } = useParams<{ guildId: string }>();
  const notification = useNotification();
  const plausible = usePlausible<PlausibleEvents>();
  const [expandedDay, setExpandedDay] = React.useState<number | null>(null);
  const [fillStatus, setFillStatus] = React.useState<AvailabilityStatus>('available');
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);
  const [showUnsetConfirm, setShowUnsetConfirm] = React.useState(false);
  const [showCopyConfirm, setShowCopyConfirm] = React.useState(false);
  const [showScheduleConfirm, setShowScheduleConfirm] = React.useState(false);
  const [isScheduled, setIsScheduled] = React.useState(false);
  const [copyMode, setCopyMode] = React.useState<'date' | 'weekday'>('weekday');

  const { adminText, channelLink, channelName } = getContactInfo(
    guildId,
    guildInfo?.supportChannelId,
    guildInfo?.supportChannelName,
    guildInfo?.adminContactInfo,
  );

  React.useEffect(() => {
    isMonthScheduled(guildId, target.year, target.month).then((res) => {
      if (!isFailure(res)) {
        setIsScheduled(res.data);
      }
    });
  }, [guildId, target.year, target.month]);
  const defaultDays = React.useMemo(() => {
    if (initialDays) {
      const lookup = new Map(initialDays.map((d) => [d.day, d.status]));
      const count = getDaysInMonth(target.year, target.month);
      return Array.from({ length: count }, (_, i) => ({
        day: i + 1,
        status: lookup.get(i + 1) ?? null,
      }));
    }
    return buildDefaultDays(target.year, target.month);
  }, [target.year, target.month, initialDays]);

  const doSubmit = React.useCallback(
    async (days: DayEntry[]) => {
      const resolved = days.map((d) => ({
        day: d.day,
        status: d.status ?? ('unavailable' as AvailabilityStatus),
      }));

      const result = userId
        ? await adminSubmitMemberAvailability(guildId, target.year, target.month, userId, resolved)
        : await submitAvailability(guildId, target.year, target.month, resolved);

      if (isFailure(result)) {
        notification.add({
          type: 'error',
          title: 'Error',
          description: result.error,
        });
      } else {
        plausible('submit_availability', {
          props: { guildId, year: target.year, month: target.month },
        });
        notification.add({
          type: 'success',
          title: 'Success',
          description: userId
            ? "Member's availability has been updated."
            : 'Your availability has been submitted.',
        });
        onSubmitted?.();
      }
    },
    [guildId, target.year, target.month, notification, onSubmitted, userId],
  );

  const form = useForm({
    defaultValues: {
      days: defaultDays,
    },
    onSubmit: async ({ value }) => {
      const hasUnset = value.days.some((d) => d.status === null);
      if (hasUnset) {
        setShowUnsetConfirm(true);
        return;
      }
      await doSubmit(value.days);
    },
  });

  // Compute the starting day-of-week offset for the calendar grid
  const firstDayOfWeek = new Date(Date.UTC(target.year, target.month - 1, 1)).getUTCDay();

  return (
    <Paper>
      <ConfirmDialog
        open={showUnsetConfirm}
        onOpenChange={setShowUnsetConfirm}
        title="Unset days remaining"
        description="Some days don't have a status yet. Would you like to set all remaining days to Unavailable and submit?"
        confirmLabel="Set to Unavailable & Submit"
        onConfirm={() => {
          const days = form.state.values.days.map((d) => ({
            day: d.day,
            status: d.status ?? ('unavailable' as AvailabilityStatus),
          }));
          doSubmit(days);
        }}
      />

      <ConfirmDialog
        open={showScheduleConfirm}
        onOpenChange={setShowScheduleConfirm}
        title="Schedule already created"
        description={
          <>
            The schedule for this month has already been created. Please also {adminText} to let
            them know your availability has changed.
            {channelLink && (
              <>
                {' '}
                Alternatively, reach out in{' '}
                <Link href={channelLink}>#{channelName || 'support'}</Link>.
              </>
            )}
          </>
        }
        confirmLabel="Confirm & Save"
        onConfirm={() => form.handleSubmit()}
      />

      <h2 className="text-xl font-bold">Availability for {formatMonthYear(target)}</h2>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {STATUS_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-center gap-1.5">
            <span
              className={twMerge(
                'inline-flex items-center justify-center w-5 h-5 rounded-sm',
                opt.activeClass,
              )}
            >
              <opt.icon className="w-3 h-3" />
            </span>
            <div>
              <span className="font-medium">{opt.label}</span>
              <span className="text-sage-11 text-xs ml-1.5">{opt.description}</span>
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();

          const currentDays = form.state.values.days;
          const lookup = new Map((initialDays ?? []).map((d) => [d.day, d.status]));
          const altered = currentDays.some((d) => d.status !== (lookup.get(d.day) ?? null));

          if (isScheduled && altered) {
            setShowScheduleConfirm(true);
          } else {
            form.handleSubmit();
          }
        }}
        className="flex flex-col gap-4"
      >
        {/* Bulk actions */}
        <form.Field name="days" mode="array">
          {(field) => (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={() => setShowResetConfirm(true)}
              >
                Reset All
              </Button>
              {previousMonthDays && (
                <Button type="button" size="sm" onClick={() => setShowCopyConfirm(true)}>
                  Copy Previous Month
                </Button>
              )}
              <ConfirmDialog
                open={showResetConfirm}
                onOpenChange={setShowResetConfirm}
                title="Reset all days?"
                description="This will clear all your selections back to unset. This cannot be undone."
                confirmLabel="Reset"
                confirmVariant="danger"
                onConfirm={() => {
                  field.handleChange(field.state.value.map((d) => ({ ...d, status: null })));
                  setExpandedDay(null);
                }}
              />
              {previousMonthDays && (
                <ConfirmDialog
                  open={showCopyConfirm}
                  onOpenChange={setShowCopyConfirm}
                  title="Copy previous month?"
                  description="This will replace all your current selections with last month's availability."
                  confirmLabel="Copy"
                  onConfirm={() => {
                    const prevLookup = new Map(previousMonthDays.map((d) => [d.day, d.status]));
                    const count = getDaysInMonth(target.year, target.month);

                    let mapped: Map<number, AvailabilityStatus>;
                    if (copyMode === 'weekday') {
                      mapped = mapDaysByWeekday(getPrevYearMonth(target), target, prevLookup);
                    } else {
                      mapped = prevLookup;
                    }

                    field.handleChange(
                      Array.from({ length: count }, (_, i) => ({
                        day: i + 1,
                        status: (mapped.get(i + 1) as DayStatus) ?? null,
                      })),
                    );
                    setExpandedDay(null);
                  }}
                >
                  <fieldset className="flex flex-col gap-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="copyMode"
                        value="weekday"
                        checked={copyMode === 'weekday'}
                        onChange={() => setCopyMode('weekday')}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium text-sage-12">By day of week</span>
                        <p className="text-xs text-sage-11">
                          Matches days by their position in the calendar grid. Best for recurring
                          weekly schedules.
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="copyMode"
                        value="date"
                        checked={copyMode === 'date'}
                        onChange={() => setCopyMode('date')}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium text-sage-12">By date</span>
                        <p className="text-xs text-sage-11">
                          Copies day 1 to day 1, day 2 to day 2, etc. Simple 1-to-1 mapping.
                        </p>
                      </div>
                    </label>
                  </fieldset>
                </ConfirmDialog>
              )}

              <div className="flex items-center gap-1.5 ml-auto">
                <select
                  value={fillStatus}
                  onChange={(e) => setFillStatus(e.target.value as AvailabilityStatus)}
                  className={twMerge(
                    DefaultTransitionStyles,
                    FocusResetStyles,
                    ShowFocusOnKeyboardStyles,
                    'rounded-xl border border-sage-6 bg-sage-2 px-2 py-1 text-sm text-sage-12',
                    'hover:border-sage-8 cursor-pointer',
                  )}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const hasUnset = field.state.value.some((d) => d.status === null);
                    if (!hasUnset) {
                      notification.add({
                        type: 'warning',
                        title: 'No unset days',
                        description: 'All days already have a status.',
                      });
                      return;
                    }
                    field.handleChange(
                      field.state.value.map((d) =>
                        d.status === null ? { ...d, status: fillStatus } : d,
                      ),
                    );
                  }}
                >
                  Fill Remaining
                </Button>
              </div>
            </div>
          )}
        </form.Field>

        {/* Calendar grid header */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-sage-11">
          {DAY_NAMES.map((name) => (
            <div key={name} className="py-1">
              {name}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <form.Field name="days" mode="array">
          {(field) => (
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for offset */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {field.state.value.map((entry, index) => {
                const currentStatus = entry.status;
                const currentOption = currentStatus
                  ? STATUS_OPTIONS.find((o) => o.value === currentStatus)
                  : null;
                const displayOption = currentOption ?? UNSET_OPTION;
                const isExpanded = expandedDay === entry.day;

                return (
                  <div key={entry.day} className="flex flex-col items-center gap-0.5">
                    <span className="text-xs text-sage-11">{entry.day}</span>
                    {isExpanded ? (
                      <div className="grid grid-cols-2 gap-0.5 w-full">
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className={twMerge(
                              DefaultTransitionStyles,
                              FocusResetStyles,
                              ShowFocusOnKeyboardStyles,
                              'rounded-md p-1.5 cursor-pointer',
                              'flex items-center justify-center',
                              'bg-sage-5 text-sage-12 hover:bg-sage-7',
                              opt.activeClass,
                            )}
                            onClick={() => {
                              const newDays = [...field.state.value];
                              newDays[index] = {
                                ...newDays[index],
                                status: opt.value,
                              };
                              field.handleChange(newDays);
                              setExpandedDay(null);
                            }}
                            title={opt.label}
                            aria-label={opt.label}
                            aria-pressed={currentStatus === opt.value}
                          >
                            <opt.icon className="w-3.5 h-3.5" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={twMerge(
                          DefaultTransitionStyles,
                          FocusResetStyles,
                          ShowFocusOnKeyboardStyles,
                          'w-full rounded-md px-1 py-5 text-xs font-medium cursor-pointer',
                          'flex items-center justify-center gap-0.5',
                          'bg-sage-5 text-sage-12 hover:bg-sage-7',
                          displayOption.activeClass,
                        )}
                        onClick={() => setExpandedDay(entry.day)}
                        title={`Day ${entry.day}: ${displayOption.label}`}
                        aria-label={`Day ${entry.day}: ${displayOption.label}`}
                      >
                        <displayOption.icon className="w-3 h-3 shrink-0" />
                        <span className="hidden md:inline">{displayOption.label}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <div className="flex justify-end">
              <Button type="submit" variant="primary" disabled={!canSubmit} loading={isSubmitting}>
                Submit Availability
              </Button>
            </div>
          )}
        />
      </form>
    </Paper>
  );
}
