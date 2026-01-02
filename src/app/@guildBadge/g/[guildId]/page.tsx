import { getUsersGuilds } from '@/actions/guilds';
import { unwrapData } from '@/actions/action-helpers';
import { twMerge } from 'tailwind-merge';
import GuildIcon from '@/components/GuildIcon';

export default async function GuildBadgePage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const guildsResult = await getUsersGuilds();
  const guilds = unwrapData(guildsResult) ?? [];
  const guild = guilds.find((guild) => guild.id === guildId);

  if (!guild) {
    return null;
  }

  return (
    <div
      className={twMerge(
        'flex items-center justify-center gap-2',
        'border border-sage-8 rounded-md py-1 px-2 font-serif shadow',
      )}
    >
      <GuildIcon guild={guild} className="md:size-8" />

      <p className="text-xl">{guild.name}</p>
    </div>
  );
}
