import { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import Paper from '@/components/Paper';
import Alert from '@/components/Alert';
import SignInButton from '@/components/SignInButton';
import Link from '@/components/Link';
import { getGuildInfo, getUsersGuilds } from '@/actions/guilds';
import { isFailure } from '@/actions/result';
import { getNow, isDateOverridden } from '@/lib/availability';
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

  if (role === 'none') {
    return (
      <Paper className="items-center">
        <h2 className="text-xl">You don&apos;t have access to Tavern Master for this guild.</h2>
        <p>If you think this is a mistake, please contact the guild owner.</p>
      </Paper>
    );
  }

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

  return (
    <div className="flex flex-col gap-4 mb-8">
      {isDateOverridden() && (
        <div className="rounded-md bg-violet-5 text-violet-12 px-3 py-1.5 text-xs font-medium text-center">
          Date override active:{' '}
          {getNow().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
      )}
      <GuildTabBar guildId={guildId} isAdmin={role === 'admin'} />
      {children}
    </div>
  );
}
