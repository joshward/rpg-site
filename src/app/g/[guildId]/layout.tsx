import { ReactNode } from 'react';
import { GuildRouteProps } from './helpers';
import { getUsersGuilds } from '@/actions/guilds';
import { unwrapData } from '@/actions/action-helpers';
import { twMerge } from 'tailwind-merge';
import GuildIcon from '@/components/GuildIcon';

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
}> &
  GuildRouteProps) {
  const { guildId } = await params;
  const guildsResult = await getUsersGuilds();
  const guilds = unwrapData(guildsResult) ?? [];
  const guild = guilds.find((guild) => guild.id === guildId);

  return (
    <div className="flex flex-col items-stretch gap-6">
      {guild && (
        <div
          className={twMerge(
            'flex items-center justify-center self-start gap-2',
            'border border-sage-8 rounded-md py-2 px-4',
          )}
        >
          <GuildIcon guild={guild} className="md:size-8" />

          <p className="text-xl">{guild.name}</p>
        </div>
      )}
      {children}
    </div>
  );
}
