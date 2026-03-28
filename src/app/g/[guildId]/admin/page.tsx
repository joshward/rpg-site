import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Paper from '@/components/Paper';
import Alert from '@/components/Alert';
import { getGuildInfo, getGuildRolesAction, getUsersGuilds } from '@/actions/guilds';
import { isFailure } from '@/actions/result';
import { getDefaultMetadata } from '@/lib/metadata';
import { GuildRouteProps } from '../helpers';
import GuildAdminForm from './_components/GuildAdminForm';

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
      subtitle = `${guild.name} Admin`;
    }
  }

  return getDefaultMetadata({ subtitles: subtitle });
}

export default async function GuildAdminPage({ params }: GuildRouteProps) {
  const { guildId } = await params;

  const guildInfoResult = await getGuildInfo(guildId);
  if (isFailure(guildInfoResult)) {
    return (
      <Paper className="items-center">
        <Alert type="error">{guildInfoResult.error}</Alert>
      </Paper>
    );
  }

  const { role, allowedRoles } = guildInfoResult.data;

  if (role !== 'admin') {
    notFound();
  }

  const rolesResult = await getGuildRolesAction(guildId);
  if (isFailure(rolesResult)) {
    return (
      <Paper className="items-center">
        <Alert type="error">{rolesResult.error}</Alert>
      </Paper>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Guild Administration</h1>
      <GuildAdminForm roles={rolesResult.data} initialAllowedRoles={allowedRoles} />
    </div>
  );
}
