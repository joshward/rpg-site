import { Metadata } from 'next';
import Paper from '@/components/Paper';
import Alert from '@/components/Alert';
import { getMyAvailability } from '@/actions/availability';
import { isFailure } from '@/actions/result';
import { getDefaultMetadata } from '@/lib/metadata';
import {
  getAvailableMonth,
  getSubmissionWindowOpen,
  getNextMonth,
  formatMonthYear,
} from '@/lib/availability';
import { GuildRouteProps, getGuildName } from '../helpers';

export async function generateMetadata({ params }: GuildRouteProps): Promise<Metadata> {
  const { guildId } = await params;
  const guildName = await getGuildName(guildId);
  return getDefaultMetadata({ subtitles: ['Availability', guildName].filter(Boolean) as string[] });
}
import AvailabilityForm from './_components/AvailabilityForm';
import AvailabilityReadOnly from './_components/AvailabilityReadOnly';

export default async function AvailabilityPage({ params }: GuildRouteProps) {
  const { guildId } = await params;

  // Check if the submission window is open
  const target = getAvailableMonth();

  if (!target) {
    const nextMonth = getNextMonth();
    const windowOpen = getSubmissionWindowOpen(nextMonth);

    return (
      <Paper className="items-center">
        <h2 className="text-xl font-bold">Availability</h2>
        <p className="text-sage-11">
          The submission window for {formatMonthYear(nextMonth)} opens on{' '}
          {windowOpen.toLocaleDateString('en-US', {
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

  // Check if the user has already submitted
  const existingResult = await getMyAvailability(guildId, target.year, target.month);
  if (isFailure(existingResult)) {
    return (
      <Paper className="items-center">
        <Alert type="error">{existingResult.error}</Alert>
      </Paper>
    );
  }

  if (existingResult.data) {
    return (
      <AvailabilityReadOnly
        target={target}
        days={existingResult.data.days}
        submittedAt={existingResult.data.createdAt}
      />
    );
  }

  return <AvailabilityForm target={target} />;
}
