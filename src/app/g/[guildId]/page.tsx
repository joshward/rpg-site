import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Paper from '@/components/Paper';
import { getGuildInfo, getUsersGuilds } from '@/actions/guilds';
import { isFailure } from '@/actions/result';
import Alert from '@/components/Alert';
import SignInButton from '@/components/SignInButton';
import { getDefaultMetadata } from '@/lib/metadata';
import { GuildRouteProps } from './helpers';

export async function generateMetadata({ params }: GuildRouteProps): Promise<Metadata> {
  const { guildId } = await params;
  const guildsResult = await getUsersGuilds();

  let subtitle: string | undefined;

  if (isFailure(guildsResult)) {
    subtitle = 'Error';
  } else {
    const guild = guildsResult.data
      ? guildsResult.data.find((guild) => guild.id === guildId)
      : undefined;

    if (guild) {
      subtitle = guild.name;
    }
  }

  return getDefaultMetadata({ subtitles: subtitle });
}

export default async function GuildPage({ params }: GuildRouteProps) {
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

  const { role } = guildInfoResult.data;
  if (role === 'none') {
    return (
      <Paper className="items-center">
        <h2 className="text-xl">You don't have access to Tavern Master for this guild.</h2>
        <p>If you think this is a mistake, please contact the guild owner.</p>
      </Paper>
    );
  }

  return <Paper>Guild Role: {guildInfoResult.data.role}</Paper>;
}
