import { notFound } from 'next/navigation';
import Paper from '@/components/Paper';
import Alert from '@/components/Alert';
import { getGuildInfo, getUsersGuilds } from '@/actions/guilds';
import { getMyAvailability } from '@/actions/availability';
import { isFailure } from '@/actions/result';
import SignInButton from '@/components/SignInButton';
import {
  getAvailableMonth,
  getSubmissionWindowOpen,
  getNextMonth,
  formatMonthYear,
} from '@/lib/availability';
import { GuildRouteProps } from '../helpers';
import AvailabilityForm from './_components/AvailabilityForm';
import AvailabilityReadOnly from './_components/AvailabilityReadOnly';

export default async function AvailabilityPage({ params }: GuildRouteProps) {
  const { guildId } = await params;
  const guildsResult = await getUsersGuilds();

  if (isFailure(guildsResult)) {
    return (
      <Paper className="items-center">
        <Alert type="error">{guildsResult.error}</Alert>
      </Paper>
    );
  }

  const userGuilds = guildsResult.data;

  if (!userGuilds) {
    return (
      <Paper className="items-center">
        <h2>Your session has expired. Please log in again.</h2>
        <SignInButton signInText="Log in with Discord" />
      </Paper>
    );
  }

  if (!userGuilds.some((guild) => guild.id === guildId)) {
    notFound();
  }

  const guildInfoResult = await getGuildInfo(guildId);
  if (isFailure(guildInfoResult)) {
    return (
      <Paper className="items-center">
        <Alert type="error">{guildInfoResult.error}</Alert>
      </Paper>
    );
  }

  const { role, isConfigured } = guildInfoResult.data;
  if (!isConfigured || role === 'none') {
    notFound();
  }

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
