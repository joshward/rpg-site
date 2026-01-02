import { Avatar } from '@base-ui/react/avatar';
import { twMerge } from 'tailwind-merge';

export default function GuildIcon({
  guild,
  className,
}: {
  guild: { id: string; name: string; icon: string | null | undefined };
  className?: string;
}) {
  return (
    <Avatar.Root
      className={twMerge(
        'inline-flex size-8 md:size-12 items-center justify-center overflow-hidden rounded-full align-middle select-none bg-sage-5',
        className,
      )}
    >
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
  );
}
