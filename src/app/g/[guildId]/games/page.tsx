import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Paper from '@/components/Paper';
import Alert from '@/components/Alert';
import { getGuildInfo } from '@/actions/guilds';
import { getGames } from '@/actions/games';
import { isFailure } from '@/actions/result';
import { getDefaultMetadata } from '@/lib/metadata';
import { GuildRouteProps, getGuildName } from '../helpers';
import GameList from './_components/GameList';

export async function generateMetadata({ params }: GuildRouteProps): Promise<Metadata> {
  const { guildId } = await params;
  const guildName = await getGuildName(guildId);
  return getDefaultMetadata({
    subtitles: ['Games', guildName].filter(Boolean) as string[],
  });
}

export default async function GamesPage({ params }: GuildRouteProps) {
  const { guildId } = await params;

  const guildInfoResult = await getGuildInfo(guildId);
  if (isFailure(guildInfoResult)) {
    return (
      <Paper className="items-center">
        <Alert type="error">{guildInfoResult.error}</Alert>
      </Paper>
    );
  }

  const { role } = guildInfoResult.data;

  // Only admins for now
  if (role !== 'admin') {
    notFound();
  }

  const gamesResult = await getGames(guildId);
  if (isFailure(gamesResult)) {
    return (
      <Paper className="items-center">
        <Alert type="error">{gamesResult.error}</Alert>
      </Paper>
    );
  }

  return <GameList initialGames={gamesResult.data} />;
}
