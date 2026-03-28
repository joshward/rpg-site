import { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import Paper from '@/components/Paper';
import Alert from '@/components/Alert';
import SignInButton from '@/components/SignInButton';
import Link from '@/components/Link';
import { getGuildInfo, getUsersGuilds } from '@/actions/guilds';
import { isFailure } from '@/actions/result';
import { GuildRouteProps } from './helpers';
import GuildTabBar from './_components/GuildTabBar';

interface GuildLayoutProps extends GuildRouteProps {
  children: ReactNode;
}

export default async function GuildLayout({ params, children }: GuildLayoutProps) {
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

  if (!isConfigured) {
    return (
      <Paper className="items-center">
        <Alert type={role === 'admin' ? 'warning' : 'error'}>
          This guild is not yet configured for Tavern Master.{' '}
          {role === 'admin' && <Link href={`/g/${guildId}/admin`}>Configure it here.</Link>}
        </Alert>
      </Paper>
    );
  }

  if (role === 'none') {
    return (
      <Paper className="items-center">
        <h2 className="text-xl">You don&apos;t have access to Tavern Master for this guild.</h2>
        <p>If you think this is a mistake, please contact the guild owner.</p>
      </Paper>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <GuildTabBar guildId={guildId} isAdmin={role === 'admin'} />
      {children}
    </div>
  );
}
