import { redirect, RedirectType } from 'next/navigation';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';
import { FocusResetStyles, ShowFocusOnKeyboardStyles } from '@/styles/common';
import { getUsersGuilds } from '@/actions/guilds';
import SignInButton from '@/components/SignInButton';
import { isFailure } from '@/actions/result';
import Alert from '@/components/Alert';
import Paper from '@/components/Paper';
import GuildIcon from '@/components/GuildIcon';

function makeGuildLink(guildId: string) {
  return `/g/${guildId}`;
}

export default async function GuildPicker() {
  const guildsResult = await getUsersGuilds();

  if (isFailure(guildsResult)) {
    return (
      <Paper className="items-center">
        <Alert type="error">{guildsResult.error}</Alert>
      </Paper>
    );
  }

  const guilds = guildsResult.data;

  if (!guilds) {
    return (
      <Paper className="items-center">
        <h2>Welcome to Tavern Master. Log in to continue.</h2>
        <SignInButton signInText="Log in with Discord" />
      </Paper>
    );
  }

  if (guilds.length === 0) {
    return (
      <Paper className="items-center">
        <p>Looks like you're not in any Discord guilds using this app. Join one to get started!</p>
      </Paper>
    );
  }

  if (guilds.length === 1) {
    redirect(makeGuildLink(guilds[0].id), RedirectType.replace);
  }

  return (
    <Paper className="items-center">
      <h2>Select a guild</h2>
      {guilds.map((guild) => (
        <Link
          href={makeGuildLink(guild.id)}
          key={guild.id}
          className={twMerge(
            FocusResetStyles,
            ShowFocusOnKeyboardStyles,
            'flex items-center justify-center gap-2 select-none',
            'border border-sage-8 rounded-md p-4 hover:bg-sage-10/10 cursor-pointer',
            'self-stretch',
          )}
        >
          <GuildIcon guild={guild} />

          <p className="text-xl md:text-2xl">{guild.name}</p>
        </Link>
      ))}
    </Paper>
  );
}
