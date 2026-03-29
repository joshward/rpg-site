import { Metadata } from 'next';
import Paper from '@/components/Paper';
import { getDefaultMetadata } from '@/lib/metadata';
import { GuildRouteProps, getGuildName } from './helpers';

export async function generateMetadata({ params }: GuildRouteProps): Promise<Metadata> {
  const { guildId } = await params;
  const guildName = await getGuildName(guildId);
  return getDefaultMetadata({ subtitles: guildName });
}

export default function GuildPage() {
  return (
    <Paper>
      <h2 className="text-xl font-bold">Overview</h2>
      <p className="text-sage-11">Welcome to your guild. More features coming soon.</p>
    </Paper>
  );
}
