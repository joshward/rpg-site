import {
  BellIcon,
  CrossCircledIcon,
  EyeClosedIcon,
  HeartFilledIcon,
  QuestionMarkCircledIcon,
} from '@radix-ui/react-icons';
import type { AggregatedTopic } from '@/lib/consent/aggregate';
import Paper from '@/components/Paper';

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

export default function ConsentAggregate({ topics }: { topics: AggregatedTopic[] }) {
  const needsCare = topics.filter((topic) => topic.needsCare);
  const allGood = topics.filter((topic) => !topic.needsCare);
  const names = new Map(topics.map((topic) => [topic.id, topic.name]));
  const rows = (items: AggregatedTopic[]) => (
    <ul className="divide-y divide-sage-6">
      {items.map((topic) => {
        const { label, icon: Icon, color } = styles[topic.answer ?? 'unknown'];
        return (
          <li
            key={topic.id}
            className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              {topic.parentTopicId && (
                <p className="text-xs text-sage-11">{names.get(topic.parentTopicId)}</p>
              )}
              <h3 className="font-medium">{topic.name}</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`inline-flex items-center gap-2 rounded-md px-2 py-1 ${color}`}>
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </span>
              {topic.headsUp && (
                <span className="inline-flex items-center gap-1 rounded-md bg-plum-9 px-2 py-1 text-white">
                  <BellIcon aria-hidden="true" className="size-4" />
                  Heads-up
                </span>
              )}
              {topic.missingAnswers > 0 && (
                <span className="text-sage-11">
                  Missing {topic.missingAnswers} {topic.missingAnswers === 1 ? 'answer' : 'answers'}
                </span>
              )}
            </div>
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
        agreement.
      </p>
      {needsCare.length ? rows(needsCare) : <p>No topics currently need special care.</p>}
      {allGood.length > 0 && (
        <details className="mt-4 border-t border-sage-6 pt-3">
          <summary className="cursor-pointer font-medium text-jade-11">
            All good from everyone ({allGood.length})
          </summary>
          {rows(allGood)}
        </details>
      )}
    </Paper>
  );
}
