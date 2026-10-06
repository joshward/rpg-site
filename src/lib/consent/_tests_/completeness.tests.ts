import { describe, expect, it } from 'vitest';
import { missingConsentTopicIds } from '../completeness';

const topics = [
  { id: 'parent', parentTopicId: null },
  { id: 'child', parentTopicId: 'parent' },
  { id: 'other', parentTopicId: null },
];

describe('guild checklist completeness', () => {
  it('requires explicit answers to every main topic, even when all children are answered', () => {
    expect(missingConsentTopicIds(topics, [{ topicId: 'child', answer: 'veil' }])).toEqual([
      'parent',
      'other',
    ]);
  });

  it('counts an answered parent as covering an unanswered child', () => {
    expect(missingConsentTopicIds(topics, [{ topicId: 'parent', answer: 'line' }])).toEqual([
      'other',
    ]);
    expect(
      missingConsentTopicIds(topics, [
        { topicId: 'parent', answer: 'line' },
        { topicId: 'child', answer: 'enthusiastic' },
        { topicId: 'other', answer: 'veil' },
      ]),
    ).toEqual([]);
  });

  it('does not count note-only responses as consent, but still inherits an answered parent', () => {
    expect(missingConsentTopicIds(topics, [{ topicId: 'parent', answer: null }])).toEqual([
      'parent',
      'child',
      'other',
    ]);
    expect(
      missingConsentTopicIds(topics, [
        { topicId: 'parent', answer: 'veil' },
        { topicId: 'child', answer: null },
        { topicId: 'other', answer: 'enthusiastic' },
      ]),
    ).toEqual([]);
  });
});
