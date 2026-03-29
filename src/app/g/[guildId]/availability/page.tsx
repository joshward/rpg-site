import { Metadata } from 'next';
import Alert from '@/components/Alert';
import { getMyAvailability } from '@/actions/availability';
import { isFailure } from '@/actions/result';
import { getDefaultMetadata } from '@/lib/metadata';
import {
  getAvailableMonth,
  getCurrentMonth,
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

  // Fetch existing submission if any
  const existingResult = await getMyAvailability(guildId, viewedMonth.year, viewedMonth.month);
  if (isFailure(existingResult)) {
    return <Alert type="error">{existingResult.error}</Alert>;
  }

  return (
    <div className="flex flex-col gap-4">
      <MonthNav current={viewedMonth} defaultMonth={defaultMonth} />
      <AvailabilityView
        target={viewedMonth}
        existing={existingResult.data}
        windowOpen={windowOpen}
      />
    </div>
  );
}
