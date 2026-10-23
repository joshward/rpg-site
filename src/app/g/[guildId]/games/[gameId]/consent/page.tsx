import { notFound } from 'next/navigation';
import { Pencil2Icon, FileTextIcon } from '@radix-ui/react-icons';
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
        <div className="print:hidden mt-3 flex flex-wrap gap-3">
          <Link
            href={`/g/${guildId}/preferences#content-checklist`}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-violet-7 bg-violet-3 px-3 py-2 text-sm font-medium hover:bg-violet-4 hover:no-underline"
          >
            <Pencil2Icon aria-hidden="true" className="size-4" />
            Review or change my checklist
          </Link>
          <Link
            href={`/g/${guildId}/games/${gameId}/consent/print`}
            target="_blank"
            rel="noopener noreferrer"
            prefetch={false}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-violet-7 px-3 py-2 text-sm font-medium hover:bg-violet-4 hover:no-underline"
          >
            <FileTextIcon aria-hidden="true" className="size-4" />
            Print / save PDF
            <span className="sr-only"> (opens in a new tab)</span>
          </Link>
        </div>
      </div>
      <ConsentOverview
        key={`${guildId}:${gameId}:${result.data.canViewContributions}`}
        guildId={guildId}
        gameId={gameId}
        topics={result.data.topics}
        canViewPrivateDetails={result.data.canViewContributions}
        overallGroupNote={result.data.overallGroupNote}
      />
    </div>
  );
}
