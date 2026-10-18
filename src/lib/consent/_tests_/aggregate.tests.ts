import { describe, expect, it } from 'vitest';
import { aggregateConsentTopics, type AggregateResponse } from '../aggregate';
const topics = [
  { id: 'parent', parentTopicId: null, name: 'Parent' },
  { id: 'child', parentTopicId: 'parent', name: 'Child' },
];
const row = (
  discordUserId: string,
  topicId: string,
  answer: AggregateResponse['answer'],
  headsUp = false,
) => ({ discordUserId, topicId, answer, headsUp });

describe('game content aggregation', () => {
  it('applies explicit child choices per player before taking the most restrictive answer', () => {
    const result = aggregateConsentTopics(
      topics,
      ['a', 'b'],
      [row('a', 'parent', 'line'), row('a', 'child', 'enthusiastic'), row('b', 'parent', 'veil')],
    );
    expect(result[0]).toMatchObject({ answer: 'line', missingAnswers: 0, needsCare: true });
    expect(result[1]).toMatchObject({ answer: 'veil', missingAnswers: 0, needsCare: true });
  });
  it('keeps missing responses separate and never treats a note-only row as an answer', () => {
    const result = aggregateConsentTopics(
      topics,
      ['a', 'b'],
      [row('a', 'parent', 'veil'), row('b', 'child', null)],
    );
    expect(result[0]).toMatchObject({ answer: 'veil', missingAnswers: 1 });
    expect(result[1]).toMatchObject({ answer: 'veil', missingAnswers: 1 });
    expect(
      aggregateConsentTopics(topics, ['a'], [row('a', 'child', 'enthusiastic')])[0],
    ).toMatchObject({ answer: null, missingAnswers: 1, needsCare: true });
  });
  it('inherits heads-up with a parent, but an explicit child overrides its parent choice', () => {
    const result = aggregateConsentTopics(
      topics,
      ['a'],
      [row('a', 'parent', 'enthusiastic', true)],
    );
    expect(result.every((topic) => topic.headsUp && topic.needsCare)).toBe(true);
    const child = aggregateConsentTopics(
      topics,
      ['a'],
      [row('a', 'parent', 'veil', true), row('a', 'child', 'enthusiastic')],
    )[1];
    expect(child).toMatchObject({ answer: 'enthusiastic', headsUp: false, needsCare: false });
  });
  it('ignores nonmembers and returns only aggregated fields, with no identity or private-note fields', () => {
    const result = aggregateConsentTopics(
      topics,
      ['a', 'a'],
      [row('a', 'parent', 'enthusiastic'), row('outsider', 'parent', 'line')],
    );
    expect(result[0]).toMatchObject({
      answer: 'enthusiastic',
      missingAnswers: 0,
      needsCare: false,
    });
    expect(Object.keys(result[0]).sort()).toEqual(
      ['answer', 'headsUp', 'id', 'missingAnswers', 'name', 'needsCare', 'parentTopicId'].sort(),
    );
  });
  it('marks fully unknown topics for care and combines heads-up even alongside a hard line', () => {
    expect(aggregateConsentTopics(topics, ['a', 'b'], [])[0]).toMatchObject({
      answer: null,
      missingAnswers: 2,
      needsCare: true,
    });
    expect(
      aggregateConsentTopics(
        topics,
        ['a', 'b'],
        [row('a', 'parent', 'line'), row('b', 'parent', 'enthusiastic', true)],
      )[0],
    ).toMatchObject({ answer: 'line', headsUp: true, missingAnswers: 0 });
  });
});
