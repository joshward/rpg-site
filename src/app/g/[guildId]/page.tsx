import { Metadata } from 'next';
import Paper from '@/components/Paper';
import Alert from '@/components/Alert';
import Link from '@/components/Link';
import { getMyPreference } from '@/actions/preferences';
import { getMyGames } from '@/actions/games';
import { isFailure } from '@/actions/result';
import { getDefaultMetadata } from '@/lib/metadata';
import { NO_LIMIT } from '@/lib/preferences';
import { GuildRouteProps, getGuildName } from './helpers';
import UserGameList from './_components/UserGameList';

export async function generateMetadata({ params }: GuildRouteProps): Promise<Metadata> {
  const { guildId } = await params;
  const guildName = await getGuildName(guildId);
  return getDefaultMetadata({ subtitles: guildName });
}

export default async function GuildPage({ params }: GuildRouteProps) {
  const { guildId } = await params;
  const [prefResult, gamesResult] = await Promise.all([
    getMyPreference(guildId),
    getMyGames(guildId),
  ]);

  let banner = null;
  const myGames = isFailure(gamesResult) ? [] : gamesResult.data;

  if (!isFailure(prefResult)) {
    const { sessionsPerMonth } = prefResult.data;

    // 1. If unset, show the unset warning
    if (sessionsPerMonth === null) {
      banner = (
        <Alert type="warning">
          Your session preference is unset. Please{' '}
          <Link href={`/g/${guildId}/preferences`}>set your ideal sessions per month</Link> so
          admins know your availability.
        </Alert>
      );
    } else {
      // 2. Check for over-scheduled warning
      // Only count active games where the user is a Core Participant (required)
      const activeRequiredGames = myGames.filter((g) => g.status === 'active' && g.isRequired);
      const totalSessions = activeRequiredGames.reduce((acc, g) => acc + g.sessionsPerMonth, 0);

      const isOverScheduled = sessionsPerMonth !== NO_LIMIT && totalSessions > sessionsPerMonth;

      if (isOverScheduled) {
        banner = (
          <Alert type="warning">
            You are scheduled for more sessions in games than your set preferences.{' '}
            <Link href={`/g/${guildId}/preferences`}>Update your preferences</Link> or talk to your
            guild admin if you cannot participate.
          </Alert>
        );
      } else if (sessionsPerMonth === 0) {
        // 3. If set to 0 and NOT over-scheduled (which means 0 sessions), show the info banner
        banner = (
          <Alert type="info">
            You are currently set as <strong>not participating</strong> (0 sessions per month). You
            can change this in <Link href={`/g/${guildId}/preferences`}>My Preferences</Link>.
          </Alert>
        );
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {banner}
      <Paper>
        <h2 className="text-xl font-bold">Overview</h2>
        <p className="text-sage-11">Welcome to your guild.</p>
      </Paper>

      {myGames.length > 0 && <UserGameList games={myGames} />}
    </div>
  );
}
