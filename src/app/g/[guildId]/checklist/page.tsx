import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getGuildInfo } from '@/actions/guilds';
import { getMyConsentChecklist } from '@/actions/consent-checklist';
import { isFailure } from '@/actions/result';
import Paper from '@/components/Paper';
import Alert from '@/components/Alert';
import { getDefaultMetadata } from '@/lib/metadata';
import { GuildRouteProps, getGuildName } from '../helpers';
import ChecklistForm from './_components/ChecklistForm';

export async function generateMetadata({ params }: GuildRouteProps): Promise<Metadata> {
  const { guildId } = await params;
  const guildName = await getGuildName(guildId);
  return getDefaultMetadata({ subtitles: ['My Checklist', guildName].filter(Boolean) as string[] });
}

export default async function ChecklistPage({ params }: GuildRouteProps) {
  const { guildId } = await params;
  const guildInfo = await getGuildInfo(guildId);
  if (isFailure(guildInfo) || !guildInfo.data.consentChecklistAvailable) notFound();

  // This action independently checks the server feature gate, guild and caller.
  const result = await getMyConsentChecklist(guildId);
  if (isFailure(result)) {
    return (
      <Paper>
        <Alert type="error">{result.error}</Alert>
      </Paper>
    );
  }
  return <ChecklistForm guildId={guildId} initialChecklist={result.data} />;
}
