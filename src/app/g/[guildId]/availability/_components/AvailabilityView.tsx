'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DayAvailability } from '@/actions/availability';
import type { YearMonth } from '@/lib/availability';
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
  const [editing, setEditing] = useState(!existing);

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

  // No existing submission and window not open — shouldn't reach here
  // since the page handles the "window closed" case, but just in case
  return null;
}
