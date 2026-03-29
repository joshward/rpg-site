'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useForm } from '@tanstack/react-form';
import { twMerge } from 'tailwind-merge';
import Button from '@/components/Button';
import Paper from '@/components/Paper';
import { useNotification } from '@/components/Notification';
import { submitAvailability, type AvailabilityStatus } from '@/actions/availability';
import { isFailure } from '@/actions/result';
import { getDaysInMonth, formatMonthYear, type YearMonth } from '@/lib/availability';
import { STATUS_OPTIONS, UNSET_OPTION } from './availability-status';
import {
  DefaultTransitionStyles,
  FocusResetStyles,
  ShowFocusOnKeyboardStyles,
} from '@/styles/common';

interface AvailabilityFormProps {
  target: YearMonth;
  onSubmitted?: () => void;
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

export default function AvailabilityForm({ target, onSubmitted }: AvailabilityFormProps) {
  const { guildId } = useParams<{ guildId: string }>();
  const notification = useNotification();
  const [expandedDay, setExpandedDay] = React.useState<number | null>(null);
  const defaultDays = React.useMemo(
    () => buildDefaultDays(target.year, target.month),
    [target.year, target.month],
  );

  const form = useForm({
    defaultValues: {
      days: defaultDays,
    },
    onSubmit: async ({ value }) => {
      const days = value.days.map((d) => ({
        day: d.day,
        status: d.status ?? 'unavailable',
      })) as { day: number; status: AvailabilityStatus }[];
      const result = await submitAvailability(guildId, target.year, target.month, days);

      if (isFailure(result)) {
        notification.add({
          type: 'error',
          title: 'Error',
          description: result.error,
        });
      } else {
        notification.add({
          type: 'success',
          title: 'Success',
          description: 'Your availability has been submitted.',
        });
        onSubmitted?.();
      }
    },
  });

  // Compute the starting day-of-week offset for the calendar grid
  const firstDayOfWeek = new Date(Date.UTC(target.year, target.month - 1, 1)).getUTCDay();

  return (
    <Paper>
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
          form.handleSubmit();
        }}
        className="flex flex-col gap-4"
      >
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
              <Button type="submit" disabled={!canSubmit} loading={isSubmitting}>
                Submit Availability
              </Button>
            </div>
          )}
        />
      </form>
    </Paper>
  );
}
