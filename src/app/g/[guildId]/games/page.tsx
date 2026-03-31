import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Paper from '@/components/Paper';
import Alert from '@/components/Alert';
import Link from '@/components/Link';
import { PlusIcon } from '@radix-ui/react-icons';
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Games</h1>
        <Link
          href={`/g/${guildId}/games/new`}
          className="flex items-center gap-2 bg-violet-9 text-white px-4 py-2 rounded-xl hover:bg-violet-10 transition-colors shadow-sm font-medium"
        >
          <PlusIcon />
          New Game
        </Link>
      </div>

      <GameList initialGames={gamesResult.data} />
    </div>
  );
}
