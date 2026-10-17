import { Metadata } from 'next';
import Alert from '@/components/Alert';
import Paper from '@/components/Paper';
import { getMyPreference } from '@/actions/preferences';
import { getMyConsentChecklist } from '@/actions/consent-checklist';
import { getGuildInfo } from '@/actions/guilds';
import { isFailure } from '@/actions/result';
import { isConsentFeatureEnabled } from '@/lib/consent/feature-gate';
import { getDefaultMetadata } from '@/lib/metadata';
import { GuildRouteProps, getGuildName } from '../helpers';
import PreferencesForm from './_components/PreferencesForm';
import ChecklistForm from './_components/ChecklistForm';
import ChecklistSection from './_components/ChecklistSection';

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

  // Never load private checklist data unless the server gate, guild setting,
  // and real (non-impersonated) player access all permit it.
  let checklist = null;
  if (isConsentFeatureEnabled()) {
    const guildInfo = await getGuildInfo(guildId);
    if (!isFailure(guildInfo) && guildInfo.data.consentChecklistAvailable) {
      checklist = await getMyConsentChecklist(guildId);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">My Preferences</h2>
      <PreferencesForm initialSessionsPerMonth={sessionsPerMonth} />
      {checklist && (
        <ChecklistSection>
          {isFailure(checklist) ? (
            <Paper>
              <Alert type="error">{checklist.error}</Alert>
            </Paper>
          ) : (
            <ChecklistForm guildId={guildId} initialChecklist={checklist.data} />
          )}
        </ChecklistSection>
      )}
    </div>
  );
}
