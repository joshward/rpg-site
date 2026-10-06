import type { ConsentAnswer } from '@/db/schema/consent-responses';

/** Top-level official topics must be answered explicitly. Children may inherit
 * an answer from their parent; a note or heads-up without an answer is not consent. */
export function missingConsentTopicIds(
  topics: readonly { id: string; parentTopicId: string | null }[],
  responses: readonly { topicId: string; answer: ConsentAnswer | null }[],
): string[] {
  const answered = new Set(
    responses.filter((row) => row.answer !== null).map((row) => row.topicId),
  );
  return topics
    .filter(
      (topic) =>
        !answered.has(topic.id) &&
        (topic.parentTopicId === null || !answered.has(topic.parentTopicId)),
    )
    .map((topic) => topic.id);
}
