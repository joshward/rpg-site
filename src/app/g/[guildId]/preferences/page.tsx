import { Metadata } from 'next';
import Alert from '@/components/Alert';
import Paper from '@/components/Paper';
import { getMyPreference } from '@/actions/preferences';
import { isFailure } from '@/actions/result';
import { getDefaultMetadata } from '@/lib/metadata';
import { GuildRouteProps, getGuildName } from '../helpers';
import PreferencesForm from './_components/PreferencesForm';

export async function generateMetadata({ params }: GuildRouteProps): Promise<Metadata> {
  const { guildId } = await params;
  const guildName = await getGuildName(guildId);
  return getDefaultMetadata({
    subtitles: ['My Preferences', guildName].filter(Boolean) as string[],
  });
}

export default async function PreferencesPage({ params }: GuildRouteProps) {
  const { guildId } = await params;

  const result = await getMyPreference(guildId);
  if (isFailure(result)) {
    return (
      <Paper>
        <Alert type="error">{result.error}</Alert>
      </Paper>
    );
  }

  const { sessionsPerMonth } = result.data;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">My Preferences</h2>
      <PreferencesForm initialSessionsPerMonth={sessionsPerMonth} />
    </div>
  );
}
