'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Paper from '@/components/Paper';
import type { DayAvailability } from '@/actions/availability';
import {
  formatMonthYear,
  getSubmissionWindowOpen,
  getNextMonth,
  isSameMonth,
  type YearMonth,
} from '@/lib/availability';
import AvailabilityForm from './AvailabilityForm';
import AvailabilityReadOnly from './AvailabilityReadOnly';

interface ExistingSubmission {
  days: DayAvailability[];
  createdAt: string;
}

interface AvailabilityViewProps {
  target: YearMonth;
  existing: ExistingSubmission | null;
  windowOpen: boolean;
}

export default function AvailabilityView({ target, existing, windowOpen }: AvailabilityViewProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(!existing && windowOpen);

  const handleSubmitted = () => {
    setEditing(false);
    router.refresh();
  };

  if (editing && windowOpen) {
    return (
      <AvailabilityForm
        target={target}
        initialDays={existing?.days}
        onSubmitted={handleSubmitted}
      />
    );
  }

  if (existing) {
    return (
      <AvailabilityReadOnly
        target={target}
        days={existing.days}
        submittedAt={existing.createdAt}
        canEdit={windowOpen}
        onEdit={() => setEditing(true)}
      />
    );
  }

  // No submission for this month
  const nextMonth = getNextMonth();
  const isFutureMonth = isSameMonth(target, nextMonth) && !windowOpen;

  if (isFutureMonth) {
    const windowOpenDate = getSubmissionWindowOpen(target);
    return (
      <Paper className="items-center">
        <p className="text-sage-11">
          The submission window for {formatMonthYear(target)} opens on{' '}
          {windowOpenDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
          })}
          .
        </p>
      </Paper>
    );
  }

  return (
    <Paper className="items-center">
      <p className="text-sage-11">No availability was submitted for {formatMonthYear(target)}.</p>
    </Paper>
  );
}
