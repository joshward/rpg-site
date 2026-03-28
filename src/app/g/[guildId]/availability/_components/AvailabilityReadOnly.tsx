import { twMerge } from 'tailwind-merge';
import Paper from '@/components/Paper';
import type { AvailabilityStatus, DayAvailability } from '@/actions/availability';
import { getDaysInMonth, formatMonthYear, type YearMonth } from '@/lib/availability';
import { STATUS_OPTIONS, STATUS_MAP } from './availability-status';

interface AvailabilityReadOnlyProps {
  target: YearMonth;
  days: DayAvailability[];
  submittedAt: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export default function AvailabilityReadOnly({
  target,
  days,
  submittedAt,
}: AvailabilityReadOnlyProps) {
  const totalDays = getDaysInMonth(target.year, target.month);
  const dayLookup = new Map(days.map((d) => [d.day, d.status]));

  const firstDayOfWeek = new Date(Date.UTC(target.year, target.month - 1, 1)).getUTCDay();

  const submittedDate = new Date(submittedAt);

  return (
    <Paper>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold">Availability for {formatMonthYear(target)}</h2>
        <p className="text-xs text-sage-11">
          Submitted on{' '}
          {submittedDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>

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

      {/* Calendar grid header */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-sage-11">
        {DAY_NAMES.map((name) => (
          <div key={name} className="py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: totalDays }, (_, i) => {
          const dayNum = i + 1;
          const status: AvailabilityStatus = dayLookup.get(dayNum) ?? 'unavailable';
          const option = STATUS_MAP[status];

          return (
            <div key={dayNum} className="flex flex-col items-center gap-0.5">
              <span className="text-xs text-sage-11">{dayNum}</span>
              <div
                className={twMerge(
                  'w-full rounded-md px-1 py-1.5 text-xs font-medium',
                  'flex items-center justify-center gap-0.5',
                  option.activeClass,
                )}
                title={`Day ${dayNum}: ${option.label}`}
              >
                <option.icon className="w-3 h-3 shrink-0" />
                <span className="hidden md:inline">{option.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Paper>
  );
}
