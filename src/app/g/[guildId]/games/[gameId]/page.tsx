import { Metadata } from 'next';
import { ClipboardIcon } from '@radix-ui/react-icons';
import { notFound } from 'next/navigation';
import Paper from '@/components/Paper';
import Alert from '@/components/Alert';
import Link from '@/components/Link';
import { getEligibleGameMembers, getGame } from '@/actions/games';
import { getGuildChannelsAction, getGuildInfo } from '@/actions/guilds';
import { isFailure } from '@/actions/result';
import { getDefaultMetadata } from '@/lib/metadata';
import { GuildRouteProps, getGuildName } from '../../helpers';
import GameForm from '../_components/GameForm';

export async function generateMetadata({ params }: GuildRouteProps): Promise<Metadata> {
  const { guildId } = await params;
  const guildName = await getGuildName(guildId);
  return getDefaultMetadata({
    subtitles: ['Edit Game', 'Games', guildName].filter(Boolean) as string[],
  });
}

export default async function EditGamePage({
  params,
}: {
  params: Promise<{ guildId: string; gameId: string }>;
}) {
  const { guildId, gameId } = await params;

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

  const [gameResult, membersResult, channelsResult] = await Promise.all([
    getGame(guildId, gameId),
    getEligibleGameMembers(guildId),
    getGuildChannelsAction(guildId),
  ]);

  if (isFailure(gameResult)) {
    return (
      <Paper className="items-center">
        <Alert type="error">{gameResult.error}</Alert>
      </Paper>
    );
  }

  if (isFailure(membersResult)) {
    return (
      <Paper className="items-center">
        <Alert type="error">{membersResult.error}</Alert>
      </Paper>
    );
  }

  if (isFailure(channelsResult)) {
    return (
      <Paper className="items-center">
        <Alert type="error">{channelsResult.error}</Alert>
      </Paper>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Edit Game: {gameResult.data.name}</h1>
      {guildInfoResult.data.consentChecklistAvailable &&
        gameResult.data.canViewConsentAggregate && (
          <Link
            href={`/g/${guildId}/games/${gameId}/consent`}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-violet-7 bg-violet-3 px-3 py-2 text-sm font-medium hover:bg-violet-4 hover:no-underline"
          >
            <ClipboardIcon aria-hidden="true" className="size-4" />
            Content Consent Overview
          </Link>
        )}
      <GameForm
        initialData={gameResult.data}
        eligibleMembers={membersResult.data}
        channels={channelsResult.data}
        showConsentMode={guildInfoResult.data.consentChecklistAvailable}
      />
    </div>
  );
}
