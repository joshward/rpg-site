import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import NextLink from 'next/link';
import {
  getCurrentMonth,
  getNextYearMonth,
  getPrevYearMonth,
  formatMonthYear,
  type YearMonth,
} from '@/lib/availability';
import { getAdminSchedule } from '@/actions/games';
import ScheduleGrid from './_components/ScheduleGrid';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import {
  DefaultTransitionStyles,
  FocusResetStyles,
  ShowFocusOnKeyboardStyles,
} from '@/styles/common';
import { twMerge } from 'tailwind-merge';

interface PageProps {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function AdminSchedulePage({ params, searchParams }: PageProps) {
  const { guildId } = await params;
  const { month: monthStr, year: yearStr } = await searchParams;

  const now = getCurrentMonth();
  let month = monthStr ? parseInt(monthStr, 10) : now.month;
  let year = yearStr ? parseInt(yearStr, 10) : now.year;

  if (isNaN(month) || month < 1 || month > 12) {
    month = now.month;
  }
  if (isNaN(year) || year < 2000 || year > 2100) {
    year = now.year;
  }

  const target: YearMonth = { month, year };

  const scheduleResult = await getAdminSchedule(guildId, target.year, target.month);

  if (scheduleResult.type === 'failure') {
    if (scheduleResult.error === 'FORBIDDEN') {
      return notFound();
    }
    return (
      <div className="p-4 bg-ruby-2 text-ruby-11 border border-ruby-4 rounded-md">
        {scheduleResult.error}
      </div>
    );
  }

  const { games, unassignedMembers } = scheduleResult.data;

  const prev = getPrevYearMonth(target);
  const next = getNextYearMonth(target);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Schedule</h1>
          <p className="text-sage-11">Review availability and plan games for the month.</p>
        </div>

        <div className="flex items-center gap-2">
          <NextLink
            href={`?month=${prev.month}&year=${prev.year}`}
            className={twMerge(
              DefaultTransitionStyles,
              FocusResetStyles,
              ShowFocusOnKeyboardStyles,
              'flex items-center justify-center gap-1 cursor-pointer rounded-xl py-1 px-2 shadow shadow-black-a5 bg-sage-5 text-sage-12 hover:bg-sage-7 text-sm',
            )}
          >
            <ChevronLeftIcon className="w-4 h-4 mr-1" />
            {formatMonthYear(prev)}
          </NextLink>

          <div className="px-4 py-1.5 bg-sage-3 rounded-md font-bold text-sm min-w-[140px] text-center border border-sage-5">
            {formatMonthYear(target)}
          </div>

          <NextLink
            href={`?month=${next.month}&year=${next.year}`}
            className={twMerge(
              DefaultTransitionStyles,
              FocusResetStyles,
              ShowFocusOnKeyboardStyles,
              'flex items-center justify-center gap-1 cursor-pointer rounded-xl py-1 px-2 shadow shadow-black-a5 bg-sage-5 text-sage-12 hover:bg-sage-7 text-sm',
            )}
          >
            {formatMonthYear(next)}
            <ChevronRightIcon className="w-4 h-4 ml-1" />
          </NextLink>
        </div>
      </div>

      <Suspense
        fallback={<div className="h-64 animate-pulse bg-sage-2 rounded-lg border border-sage-4" />}
      >
        <ScheduleGrid target={target} games={games} unassignedMembers={unassignedMembers} />
      </Suspense>
    </div>
  );
}
