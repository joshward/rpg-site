import { Metadata } from 'next';
import Alert from '@/components/Alert';
import { getMyAvailability, type DayAvailability } from '@/actions/availability';
import { isFailure } from '@/actions/result';
import { getDefaultMetadata } from '@/lib/metadata';
import {
  getAvailableMonth,
  getCurrentMonth,
  getNextMonth,
  getPrevYearMonth,
  getSubmissionWindowOpen,
  isSameMonth,
  type YearMonth,
} from '@/lib/availability';
import { GuildRouteProps, getGuildName } from '../helpers';
import AvailabilityView from './_components/AvailabilityView';
import MonthNav from './_components/MonthNav';

interface AvailabilityPageProps extends GuildRouteProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export async function generateMetadata({ params }: AvailabilityPageProps): Promise<Metadata> {
  const { guildId } = await params;
  const guildName = await getGuildName(guildId);
  return getDefaultMetadata({
    subtitles: ['Availability', guildName].filter(Boolean) as string[],
  });
}

export default async function AvailabilityPage({ params, searchParams }: AvailabilityPageProps) {
  const { guildId } = await params;
  const query = await searchParams;

  // The editable month (if the submission window is open)
  const editableMonth = getAvailableMonth();

  // Default month: the editable month if window is open, otherwise current calendar month
  const defaultMonth = editableMonth ?? getCurrentMonth();

  // Determine which month to view from search params
  const viewedMonth: YearMonth =
    query.year && query.month
      ? { year: parseInt(query.year, 10), month: parseInt(query.month, 10) }
      : defaultMonth;

  // Is this month editable?
  const windowOpen = editableMonth !== null && isSameMonth(viewedMonth, editableMonth);

  // Is this a future month where the window hasn't opened yet?
  const nextMonth = getNextMonth();
  const isFutureMonth = isSameMonth(viewedMonth, nextMonth) && !windowOpen;
  const windowOpensAt = isFutureMonth ? getSubmissionWindowOpen(viewedMonth).toISOString() : null;

  // Fetch existing submission if any
  const existingResult = await getMyAvailability(guildId, viewedMonth.year, viewedMonth.month);
  if (isFailure(existingResult)) {
    return <Alert type="error">{existingResult.error}</Alert>;
  }

  // Fetch previous month's data for copy feature (only when editable)
  let previousMonthDays: DayAvailability[] | null = null;
  if (windowOpen) {
    const prevMonth = getPrevYearMonth(viewedMonth);
    const prevResult = await getMyAvailability(guildId, prevMonth.year, prevMonth.month);
    if (!isFailure(prevResult) && prevResult.data) {
      previousMonthDays = prevResult.data.days;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <MonthNav current={viewedMonth} defaultMonth={defaultMonth} />
      <AvailabilityView
        key={`${viewedMonth.year}-${viewedMonth.month}`}
        target={viewedMonth}
        existing={existingResult.data}
        windowOpen={windowOpen}
        previousMonthDays={previousMonthDays}
        windowOpensAt={windowOpensAt}
      />
    </div>
  );
}
