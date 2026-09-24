'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { twMerge } from 'tailwind-merge';
import Button from '@/components/Button';
import {
  formatMonthYear,
  getPrevYearMonth,
  getNextYearMonth,
  getNextMonth,
  isSameMonth,
  type YearMonth,
} from '@/lib/availability';
import {
  DefaultTransitionStyles,
  FocusResetStyles,
  ShowFocusOnKeyboardStyles,
} from '@/styles/common';

interface MonthNavProps {
  current: YearMonth;
  /** The default month the page shows when no params are set */
  defaultMonth: YearMonth;
}

export default function MonthNav({ current, defaultMonth }: MonthNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigateTo = (target: YearMonth) => {
    const params = new URLSearchParams(searchParams.toString());
    if (isSameMonth(target, defaultMonth)) {
      params.delete('year');
      params.delete('month');
    } else {
      params.set('year', String(target.year));
      params.set('month', String(target.month));
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ''}`);
  };

  const prev = getPrevYearMonth(current);
  const next = getNextYearMonth(current);
  const maxMonth = getNextMonth();
  const canGoNext = !isSameMonth(current, maxMonth);
  const isDefault = isSameMonth(current, defaultMonth);

  const navButtonClass = twMerge(
    DefaultTransitionStyles,
    FocusResetStyles,
    ShowFocusOnKeyboardStyles,
    'p-1.5 rounded-md cursor-pointer',
    'text-sage-11 hover:text-sage-12 hover:bg-sage-3',
  );

  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        className={navButtonClass}
        onClick={() => navigateTo(prev)}
        title={formatMonthYear(prev)}
        aria-label="Previous month"
      >
        <ChevronLeftIcon className="w-5 h-5" />
      </button>

      <h2 className="text-xl font-bold">{formatMonthYear(current)}</h2>

      <div className="flex items-center gap-1">
        {!isDefault && (
          <Button size="sm" onClick={() => navigateTo(defaultMonth)}>
            To current
          </Button>
        )}
        <button
          type="button"
          className={twMerge(navButtonClass, !canGoNext && 'opacity-30 cursor-not-allowed')}
          onClick={() => canGoNext && navigateTo(next)}
          disabled={!canGoNext}
          title={canGoNext ? formatMonthYear(next) : 'Cannot navigate further'}
          aria-label="Next month"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
