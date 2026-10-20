import type { ConsentAnswer } from '@/db/schema/consent-responses';
import type { ConsentGroupNote } from './group-notes';

export type AggregateTopic = { id: string; parentTopicId: string | null; name: string };
export type AggregateResponse = {
  discordUserId: string;
  topicId: string;
  answer: ConsentAnswer | null;
  headsUp: boolean;
};
export type AggregatedTopic = AggregateTopic & {
  answer: ConsentAnswer | null;
  headsUp: boolean;
  missingAnswers: number;
  needsCare: boolean;
};
/** The shared overview reports missing answers without exposing counts to players. */
export type ConsentOverviewTopic = Omit<AggregatedTopic, 'missingAnswers'> & {
  missingAnswers: number | null;
  hasMissingAnswers?: boolean;
  groupNote?: ConsentGroupNote;
};
const priority = { enthusiastic: 1, veil: 2, line: 3 };

/** Resolve each player's child override before combining. Never return identities
 * or individual choices. Missing responses are unknown, not All good. */
export function aggregateConsentTopics(
  topics: readonly AggregateTopic[],
  memberIds: readonly string[],
  responses: readonly AggregateResponse[],
): AggregatedTopic[] {
  const byUser = new Map<string, Map<string, AggregateResponse>>();
  for (const response of responses) {
    const rows = byUser.get(response.discordUserId) ?? new Map();
    rows.set(response.topicId, response);
    byUser.set(response.discordUserId, rows);
  }
  const members = [...new Set(memberIds)];
  return topics.map((topic) => {
    let answer: ConsentAnswer | null = null;
    let headsUp = false;
    let missingAnswers = 0;
    for (const memberId of members) {
      const rows = byUser.get(memberId);
      const own = rows?.get(topic.id);
      const effective =
        own?.answer != null
          ? own
          : topic.parentTopicId
            ? rows?.get(topic.parentTopicId)
            : undefined;
      if (effective?.answer == null) {
        missingAnswers++;
        continue;
      }
      if (answer === null || priority[effective.answer] > priority[answer])
        answer = effective.answer;
      headsUp ||= effective.headsUp;
    }
    return {
      id: topic.id,
      parentTopicId: topic.parentTopicId,
      name: topic.name,
      answer,
      headsUp,
      missingAnswers,
      needsCare: answer !== 'enthusiastic' || headsUp || missingAnswers > 0,
    };
  });
}
