import { ReactNode } from 'react';
import { getUsersGuilds } from '@/actions/guilds';
import { Avatar } from '@base-ui/react/avatar';
import Link from 'next/link';
import { twMerge } from 'tailwind-merge';
import { FocusResetStyles, ShowFocusOnKeyboardStyles } from '@/styles/common';
import SignInButton from '@/components/SignInButton';
import { isFailure } from '@/actions/result';
import Alert from '@/components/Alert';

function Paper({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-6 bg-sage-5/30 rounded-md items-center shadow">
      {children}
    </div>
  );
}

export default async function GuildPicker() {
  const guildsResult = await getUsersGuilds();

  if (isFailure(guildsResult)) {
    return (
      <Paper>
        <Alert type="error">{guildsResult.error}</Alert>
      </Paper>
    );
  }

  const guilds = guildsResult.data;

  if (!guilds) {
    return (
      <Paper>
        <p>Welcome to Tavern Master. Log in to continue.</p>
        <SignInButton signInText="Log in with Discord" />
      </Paper>
    );
  }

  if (guilds.length === 0) {
    return (
      <Paper>
        <p>Looks like you're not in any Discord guilds using this app. Join one to get started!</p>
      </Paper>
    );
  }

  return (
    <Paper>
      <h2>Select a guild</h2>
      {guilds.map((guild) => (
        <Link
          href={`/g/${guild.id}`}
          key={guild.id}
          className={twMerge(
            FocusResetStyles,
            ShowFocusOnKeyboardStyles,
            'flex items-center justify-center gap-2 select-none',
            'border border-sage-8 rounded-md p-4 hover:bg-sage-10/10 cursor-pointer',
            'self-stretch',
          )}
        >
          <Avatar.Root className="inline-flex size-8 md:size-12 items-center justify-center overflow-hidden rounded-full align-middle select-none bg-sage-5">
            {guild.icon && (
              <Avatar.Image
                src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=48`}
                className="size-full object-cover"
                height={48}
                width={48}
              />
            )}
            <Avatar.Fallback>{guild.name[0]}</Avatar.Fallback>
          </Avatar.Root>

          <p className="text-xl md:text-2xl">{guild.name}</p>
        </Link>
      ))}
    </Paper>
  );
}
