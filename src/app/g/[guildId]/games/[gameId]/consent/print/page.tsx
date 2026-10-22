import { notFound } from 'next/navigation';
import { Pencil2Icon } from '@radix-ui/react-icons';
import { getGameConsentAggregate } from '@/actions/consent-aggregate';
import { isFailure } from '@/actions/result';
import { getDefaultMetadata } from '@/lib/metadata';
import Link from '@/components/Link';
import ConsentAggregate from '../../../_components/ConsentAggregate';
import PrintButton from './PrintButton';
import styles from './print.module.css';

export const metadata = {
  ...getDefaultMetadata({ subtitles: ['Print Content Consent Overview'] }),
  robots: { index: false, follow: false },
};

export default async function GameConsentPrintPage({
  params,
}: {
  params: Promise<{ guildId: string; gameId: string }>;
}) {
  const { guildId, gameId } = await params;
  // The same server-side gates and Requested/Optional membership rules as the
  // overview apply to every direct print URL request. Never load private APIs.
  const result = await getGameConsentAggregate(guildId, gameId);
  if (isFailure(result)) notFound();
  // oxlint-disable-next-line react/purity -- Per-request timestamp in an async Server Component; never client-rendered.
  const snapshot = new Date().toISOString();
  // Explicitly allowlist the shared fields. Even coordinators print generic
  // missing-answer presence, not counts or private-note discovery metadata.
  const topics = result.data.topics.map((topic) => ({
    id: topic.id,
    name: topic.name,
    parentTopicId: topic.parentTopicId,
    answer: topic.answer,
    headsUp: topic.headsUp,
    needsCare: topic.needsCare,
    hasMissingAnswers: topic.hasMissingAnswers ?? (topic.missingAnswers ?? 0) > 0,
    missingAnswers: null,
    groupNote: { note: topic.groupNote?.note ?? '', revision: 0 },
  }));
  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <Link href={`/g/${guildId}/games/${gameId}/consent`}>Back to consent overview</Link>
          <PrintButton />
        </div>
        <p className="text-sm text-sage-11">
          Only shared boundaries and saved group notes are included. Review group notes before
          distributing. Saved copies do not update or revoke when answers or access change. Reload
          this page for a fresh snapshot. This is not a public sharing link.
        </p>
      </div>
      <article
        className={`${styles.document} flex flex-col gap-6`}
        aria-label="Printable consent overview"
      >
        <header>
          <h1 className="text-2xl font-bold">Content Consent Overview: {result.data.gameName}</h1>
          <p className="mt-1 text-sm text-sage-11">
            Snapshot:{' '}
            <time dateTime={snapshot}>{snapshot.replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}</time>
          </p>
          <p className="mt-2 text-sm">
            Combined checklist answers for current game members. Missing answers are unknown, not
            agreement. Keep communicating at the table and revisit the overview before play; this
            copy is only a snapshot.
          </p>
        </header>
        {result.data.overallGroupNote.note && (
          <section>
            <h2 className="text-xl font-bold">Overall group notes</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">
              <Pencil2Icon aria-hidden="true" className="mr-1 inline size-4 text-violet-11" />
              {result.data.overallGroupNote.note}
            </p>
          </section>
        )}
        {topics.length ? (
          <ConsentAggregate topics={topics} expandAllGood />
        ) : (
          <p>Official consent topics are not configured yet.</p>
        )}
      </article>
    </div>
  );
}
