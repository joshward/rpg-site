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
import { STATUS_OPTIONS } from './availability-status';
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

type DayEntry = { day: number; status: AvailabilityStatus };

function buildDefaultDays(year: number, month: number): DayEntry[] {
  const count = getDaysInMonth(year, month);
  return Array.from({ length: count }, (_, i) => ({
    day: i + 1,
    status: 'no' as AvailabilityStatus,
  }));
}

export default function AvailabilityForm({ target, onSubmitted }: AvailabilityFormProps) {
  const { guildId } = useParams<{ guildId: string }>();
  const notification = useNotification();
  const defaultDays = React.useMemo(
    () => buildDefaultDays(target.year, target.month),
    [target.year, target.month],
  );

  const form = useForm({
    defaultValues: {
      days: defaultDays,
    },
    onSubmit: async ({ value }) => {
      const result = await submitAvailability(guildId, target.year, target.month, value.days);

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

      <div className="flex flex-wrap gap-2 text-sm">
        {STATUS_OPTIONS.map((opt) => (
          <span key={opt.value} className="flex items-center gap-1.5">
            <span className={twMerge('inline-block w-3 h-3 rounded-sm', opt.activeClass)} />
            {opt.label}
          </span>
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
                const currentOption = STATUS_OPTIONS.find((o) => o.value === currentStatus);

                return (
                  <div key={entry.day} className="flex flex-col items-center gap-0.5">
                    <span className="text-xs text-sage-11">{entry.day}</span>
                    <button
                      type="button"
                      className={twMerge(
                        DefaultTransitionStyles,
                        FocusResetStyles,
                        ShowFocusOnKeyboardStyles,
                        'w-full rounded-md px-1 py-1.5 text-xs font-medium cursor-pointer',
                        'bg-sage-5 text-sage-12 hover:bg-sage-7',
                        currentOption?.activeClass,
                      )}
                      onClick={() => {
                        // Cycle to the next status
                        const currentIdx = STATUS_OPTIONS.findIndex(
                          (o) => o.value === currentStatus,
                        );
                        const nextIdx = (currentIdx + 1) % STATUS_OPTIONS.length;
                        const newDays = [...field.state.value];
                        newDays[index] = {
                          ...newDays[index],
                          status: STATUS_OPTIONS[nextIdx].value,
                        };
                        field.handleChange(newDays);
                      }}
                      title={`Day ${entry.day}: ${currentOption?.label ?? currentStatus}`}
                    >
                      {currentOption?.label ?? currentStatus}
                    </button>
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
