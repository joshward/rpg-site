'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Paper from '@/components/Paper';
import type { DayAvailability } from '@/actions/availability';
import { formatMonthYear, type YearMonth } from '@/lib/availability';
import AvailabilityForm from './AvailabilityForm';
import AvailabilityReadOnly from './AvailabilityReadOnly';

interface ExistingSubmission {
  days: DayAvailability[];
  createdAt: string;
  updatedAt: string;
}

interface AvailabilityViewProps {
  target: YearMonth;
  existing: ExistingSubmission | null;
  windowOpen: boolean;
  previousMonthDays?: DayAvailability[] | null;
  /** ISO string of when the submission window opens, if this is a future month */
  windowOpensAt?: string | null;
}

export default function AvailabilityView({
  target,
  existing,
  windowOpen,
  previousMonthDays,
  windowOpensAt,
}: AvailabilityViewProps) {
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
        previousMonthDays={previousMonthDays ?? undefined}
        onSubmitted={handleSubmitted}
      />
    );
  }

  if (existing) {
    return (
      <AvailabilityReadOnly
        target={target}
        days={existing.days}
        submittedAt={existing.updatedAt}
        canEdit={windowOpen}
        onEdit={() => setEditing(true)}
      />
    );
  }

  // No submission for this month
  if (windowOpensAt) {
    const windowOpenDate = new Date(windowOpensAt);
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
