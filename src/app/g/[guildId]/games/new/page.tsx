import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Paper from '@/components/Paper';
import Alert from '@/components/Alert';
import { getGuildInfo } from '@/actions/guilds';
import { getEligibleGameMembers } from '@/actions/games';
import { isFailure } from '@/actions/result';
import { getDefaultMetadata } from '@/lib/metadata';
import { GuildRouteProps, getGuildName } from '../../helpers';
import GameForm from '../_components/GameForm';

export async function generateMetadata({ params }: GuildRouteProps): Promise<Metadata> {
  const { guildId } = await params;
  const guildName = await getGuildName(guildId);
  return getDefaultMetadata({
    subtitles: ['New Game', 'Games', guildName].filter(Boolean) as string[],
  });
}

export default async function NewGamePage({ params }: GuildRouteProps) {
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

  const membersResult = await getEligibleGameMembers(guildId);
  if (isFailure(membersResult)) {
    return (
      <Paper className="items-center">
        <Alert type="error">{membersResult.error}</Alert>
      </Paper>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Create New Game</h1>
      <GameForm eligibleMembers={membersResult.data} />
    </div>
  );
}
