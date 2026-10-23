import {
  BellIcon,
  CrossCircledIcon,
  EyeClosedIcon,
  HeartFilledIcon,
  QuestionMarkCircledIcon,
  Pencil2Icon,
} from '@radix-ui/react-icons';
import type { ReactNode } from 'react';
import type { AggregatedTopic, ConsentOverviewTopic } from '@/lib/consent/aggregate';
import Paper from '@/components/Paper';
import GroupNoteContent from './GroupNoteContent';

const styles = {
  line: { label: 'Hard line', icon: CrossCircledIcon, color: 'bg-ruby-9 text-white' },
  veil: {
    label: 'Veiled',
    icon: EyeClosedIcon,
    color: 'bg-amber-9 text-amber-12 dark:text-amber-1',
  },
  enthusiastic: {
    label: 'All good',
    icon: HeartFilledIcon,
    color: 'bg-jade-9 text-jade-12 dark:text-jade-1',
  },
  unknown: {
    label: 'No answers yet',
    icon: QuestionMarkCircledIcon,
    color: 'bg-sage-4 text-sage-12',
  },
};

const answerOrder = { line: 0, veil: 1, enthusiastic: 2, unknown: 3 };
const byName = (a: ConsentOverviewTopic, b: ConsentOverviewTopic) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id);

export function ConsentAnswerBadge({ answer }: { answer: AggregatedTopic['answer'] }) {
  const { label, icon: Icon, color } = styles[answer ?? 'unknown'];
  return (
    <span className={`inline-flex items-center gap-2 rounded-md px-2 py-1 ${color}`}>
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </span>
  );
}

export default function ConsentAggregate({
  topics,
  renderTopicDetails,
  renderTopicControl,
  renderGroupNote,
  privateNoteTopicIds,
  expandAllGood = false,
}: {
  topics: ConsentOverviewTopic[];
  renderTopicDetails?: (topic: ConsentOverviewTopic) => ReactNode;
  renderTopicControl?: (topic: ConsentOverviewTopic) => ReactNode;
  renderGroupNote?: (topic: ConsentOverviewTopic) => ReactNode;
  privateNoteTopicIds?: ReadonlySet<string>;
  expandAllGood?: boolean;
}) {
  const attentionOrder = (topic: ConsentOverviewTopic) =>
    (privateNoteTopicIds?.has(topic.id) ? 0 : 2) + (topic.headsUp ? 0 : 1);
  const needsCare = topics
    .filter(
      (topic) => topic.needsCare || topic.groupNote?.note || privateNoteTopicIds?.has(topic.id),
    )
    .sort(
      (a, b) =>
        answerOrder[a.answer ?? 'unknown'] - answerOrder[b.answer ?? 'unknown'] ||
        attentionOrder(a) - attentionOrder(b) ||
        byName(a, b),
    );
  const allGood = topics
    .filter(
      (topic) => !topic.needsCare && !topic.groupNote?.note && !privateNoteTopicIds?.has(topic.id),
    )
    .sort(byName);
  const names = new Map(topics.map((topic) => [topic.id, topic.name]));
  const rows = (items: ConsentOverviewTopic[]) => (
    <ul className="divide-y divide-sage-6">
      {items.map((topic) => {
        return (
          <li key={topic.id} className="flex flex-col gap-2 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                {topic.parentTopicId && (
                  <p className="text-xs text-sage-11">{names.get(topic.parentTopicId)}</p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-medium">{topic.name}</h3>
                  {renderTopicControl && (
                    <div className="print:hidden">{renderTopicControl(topic)}</div>
                  )}
                </div>
              </div>
              <div className="min-w-0 sm:max-w-[65%] sm:flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm sm:justify-end">
                  <ConsentAnswerBadge answer={topic.answer} />
                  {topic.headsUp && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-plum-9 px-2 py-1 text-white">
                      <BellIcon aria-hidden="true" className="size-4" />
                      Heads-up
                    </span>
                  )}
                  {(topic.hasMissingAnswers ?? (topic.missingAnswers ?? 0) > 0) && (
                    <span className="text-sage-11">
                      {topic.missingAnswers === null
                        ? 'Not everyone has answered'
                        : `Missing ${topic.missingAnswers} ${topic.missingAnswers === 1 ? 'answer' : 'answers'}`}
                    </span>
                  )}
                  {privateNoteTopicIds?.has(topic.id) && (
                    <span className="print:hidden inline-flex items-center gap-1 rounded-md bg-violet-9 px-2 py-1 text-white">
                      <Pencil2Icon aria-hidden="true" className="size-4" />
                      Private notes
                    </span>
                  )}
                </div>
                <div className="sm:text-right">
                  {renderGroupNote
                    ? renderGroupNote(topic)
                    : topic.groupNote?.note && (
                        <GroupNoteContent className="mt-2" note={topic.groupNote.note} />
                      )}
                </div>
              </div>
            </div>
            {renderTopicDetails?.(topic)}
          </li>
        );
      })}
    </ul>
  );
  return (
    <Paper>
      <h2 className="text-xl font-bold">Needs care</h2>
      <p className="text-sm text-sage-11">
        Hard lines, veils, heads-up choices and missing answers. Missing answers are unknown, not
        agreement. Topics with group notes are included here too.{' '}
        {privateNoteTopicIds?.size
          ? 'Topics with private notes are also included while unlocked.'
          : ''}
      </p>
      {needsCare.length ? rows(needsCare) : <p>No topics currently need special care.</p>}
      {allGood.length > 0 &&
        (expandAllGood ? (
          <section className="mt-4 border-t border-sage-6 pt-3">
            <h2 className="font-medium text-jade-11">All good from everyone ({allGood.length})</h2>
            {rows(allGood)}
          </section>
        ) : (
          <details className="mt-4 border-t border-sage-6 pt-3">
            <summary className="cursor-pointer font-medium text-jade-11">
              All good from everyone ({allGood.length})
            </summary>
            {rows(allGood)}
          </details>
        ))}
    </Paper>
  );
}
