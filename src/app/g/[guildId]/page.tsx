import { Metadata } from 'next';
import Paper from '@/components/Paper';
import Alert from '@/components/Alert';
import Link from '@/components/Link';
import { getMyPreference } from '@/actions/preferences';
import { getMyGames } from '@/actions/games';
import { isFailure } from '@/actions/result';
import { getDefaultMetadata } from '@/lib/metadata';
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
  if (!isFailure(prefResult)) {
    const { sessionsPerMonth } = prefResult.data;
    if (sessionsPerMonth === null) {
      banner = (
        <Alert type="warning">
          Your session preference is unset. Please{' '}
          <Link href={`/g/${guildId}/preferences`}>set your ideal sessions per month</Link> so
          admins know your availability.
        </Alert>
      );
    } else if (sessionsPerMonth === 0) {
      banner = (
        <Alert type="info">
          You are currently set as <strong>not participating</strong> (0 sessions per month). You
          can change this in <Link href={`/g/${guildId}/preferences`}>My Preferences</Link>.
        </Alert>
      );
    }
  }

  const myGames = isFailure(gamesResult) ? [] : gamesResult.data;

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
