import { notFound } from 'next/navigation';
import { getGameConsentAggregate } from '@/actions/consent-aggregate';
import { isFailure } from '@/actions/result';
import { getDefaultMetadata } from '@/lib/metadata';
import Link from '@/components/Link';
import ConsentOverview from '../../_components/ConsentOverview';

export const metadata = getDefaultMetadata({ subtitles: ['Content Consent Overview'] });

export default async function GameConsentAggregatePage({
  params,
}: {
  params: Promise<{ guildId: string; gameId: string }>;
}) {
  const { guildId, gameId } = await params;
  const result = await getGameConsentAggregate(guildId, gameId);
  if (isFailure(result)) notFound();
  // Only aggregate data and a capability flag reach the client on initial load.
  // Named responses, contribution status and notes are fetched after unlock/expansion.
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/g/${guildId}`}>Back to your games</Link>
        <h1 className="mt-2 text-2xl font-bold">
          Content Consent Overview: {result.data.gameName}
        </h1>
        <p className="mt-1 text-sm text-sage-11">
          Combined guild checklist answers for current game members. Use these boundaries to guide
          play and keep communicating at the table. Individual answers and private notes are hidden
          by default.
        </p>
      </div>
      <ConsentOverview
        key={`${guildId}:${gameId}:${result.data.canViewContributions}`}
        guildId={guildId}
        gameId={gameId}
        topics={result.data.topics}
        canViewPrivateDetails={result.data.canViewContributions}
      />
    </div>
  );
}
