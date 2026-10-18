import { notFound } from 'next/navigation';
import { getGameConsentAggregate } from '@/actions/consent-aggregate';
import { isFailure } from '@/actions/result';
import { getDefaultMetadata } from '@/lib/metadata';
import Link from '@/components/Link';
import Paper from '@/components/Paper';
import ConsentAggregate from '../../../_components/ConsentAggregate';

export const metadata = getDefaultMetadata({ subtitles: ['Game Content Boundaries'] });

export default async function GameConsentAggregatePage({
  params,
}: {
  params: Promise<{ guildId: string; gameId: string }>;
}) {
  const { guildId, gameId } = await params;
  // The read enforces all membership/coordinator and feature gates. An admin
  // who only manages the game cannot load this aggregate.
  const result = await getGameConsentAggregate(guildId, gameId);
  if (isFailure(result)) notFound();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/g/${guildId}`}>Back to your games</Link>
        <h1 className="mt-2 text-2xl font-bold">Content boundaries: {result.data.gameName}</h1>
        <p className="mt-1 text-sm text-sage-11">
          Combined guild checklist answers for current game members. Use these boundaries to guide
          play and keep communicating at the table. No individual answers or private notes are
          shown.
        </p>
      </div>
      {result.data.topics.length ? (
        <ConsentAggregate topics={result.data.topics} />
      ) : (
        <Paper>Official consent topics are not configured yet.</Paper>
      )}
    </div>
  );
}
