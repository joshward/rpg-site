import { Metadata } from 'next';
import Paper from '@/components/Paper';
import Alert from '@/components/Alert';
import Link from '@/components/Link';
import { getGuildInfo } from '@/actions/guilds';
import { getMyPreference } from '@/actions/preferences';
import { getMyGames } from '@/actions/games';
import { getMyAvailability } from '@/actions/availability';
import { isFailure } from '@/actions/result';
import { getDefaultMetadata } from '@/lib/metadata';
import { NO_LIMIT } from '@/lib/preferences';
import { getNextMonth, isLast7DaysOfCurrentMonth, formatMonthYear } from '@/lib/availability';
import { GuildRouteProps, getGuildName, getContactInfo } from './helpers';
import UserGameList from './_components/UserGameList';
import { ReactNode } from 'react';

export async function generateMetadata({ params }: GuildRouteProps): Promise<Metadata> {
  const { guildId } = await params;
  const guildName = await getGuildName(guildId);
  return getDefaultMetadata({ subtitles: guildName });
}

export default async function GuildPage({ params }: GuildRouteProps) {
  const { guildId } = await params;
  const nextMonth = getNextMonth();
  const showAvailabilityAlert = isLast7DaysOfCurrentMonth();

  const [prefResult, gamesResult, availabilityResult, guildInfoResult] = await Promise.all([
    getMyPreference(guildId),
    getMyGames(guildId),
    showAvailabilityAlert ? getMyAvailability(guildId, nextMonth.year, nextMonth.month) : null,
    getGuildInfo(guildId),
  ]);

  const banners: ReactNode[] = [];
  const myGames = isFailure(gamesResult) ? [] : gamesResult.data;

  // 1. Availability alert (only in last 7 days and if not filled)
  if (
    showAvailabilityAlert &&
    availabilityResult &&
    !isFailure(availabilityResult) &&
    !availabilityResult.data
  ) {
    banners.push(
      <Alert key="availability" type="info">
        Please fill out your availability for {formatMonthYear(nextMonth)}.{' '}
        <Link href={`/g/${guildId}/availability?year=${nextMonth.year}&month=${nextMonth.month}`}>
          Go to Availability
        </Link>
        .
      </Alert>,
    );
  }

  if (!isFailure(prefResult)) {
    const { sessionsPerMonth } = prefResult.data;

    // 2. If unset, show the unset warning
    if (sessionsPerMonth === null) {
      banners.push(
        <Alert key="preference" type="warning">
          Your session preference is unset. Please{' '}
          <Link href={`/g/${guildId}/preferences`}>set your ideal sessions per month</Link> so
          admins know your availability.
        </Alert>,
      );
    } else {
      // 3. Check for over-scheduled warning
      // Only count active games where the user is a Core Participant (required)
      const activeRequiredGames = myGames.filter((g) => g.status === 'active' && g.isRequired);
      const totalSessions = activeRequiredGames.reduce((acc, g) => acc + g.sessionsPerMonth, 0);

      const isOverScheduled = sessionsPerMonth !== NO_LIMIT && totalSessions > sessionsPerMonth;

      if (isOverScheduled) {
        const guildData = isFailure(guildInfoResult) ? null : guildInfoResult.data;
        const { adminText, channelLink, channelName } = getContactInfo(
          guildId,
          guildData?.supportChannelId,
          guildData?.supportChannelName,
          guildData?.adminContactInfo,
        );

        banners.push(
          <Alert key="over-scheduled" type="warning">
            You are scheduled for more sessions in games than your set preferences.{' '}
            <Link href={`/g/${guildId}/preferences`}>Update your preferences</Link> or {adminText}
            {channelLink && (
              <>
                {' '}
                or reach out in <Link href={channelLink}>#{channelName || 'support'}</Link>
              </>
            )}{' '}
            if you cannot participate.
          </Alert>,
        );
      } else if (sessionsPerMonth === 0) {
        // 4. If set to 0 and NOT over-scheduled (which means 0 sessions), show the info banner
        banners.push(
          <Alert key="not-participating" type="info">
            You are currently set as <strong>not participating</strong> (0 sessions per month). You
            can change this in <Link href={`/g/${guildId}/preferences`}>My Preferences</Link>.
          </Alert>,
        );
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {banners}
      <Paper>
        <h2 className="text-xl font-bold">Overview</h2>
        <p className="text-sage-11">Welcome to your guild.</p>
      </Paper>

      {myGames.length > 0 && <UserGameList games={myGames} />}
    </div>
  );
}
