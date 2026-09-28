import { describe, expect, it } from 'vitest';
import { makeStarterConsentTopicRows, starterConsentTopics } from '../starter-topics';

describe('consent starter topics', () => {
  it('has distinct answerable main topics and one level of distinct subtopics', () => {
    const names = starterConsentTopics.map((topic) => topic.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const topic of starterConsentTopics) {
      const subtopics = topic.subtopics.map((name) => name.toLowerCase());
      expect(new Set(subtopics).size).toBe(subtopics.length);
      expect(
        [topic.name, ...topic.subtopics].every((name) => name.length > 0 && name.length <= 120),
      ).toBe(true);
    }
  });

  it('assigns children to their guild-scoped parents in draft order, ahead of later additions', () => {
    const { parents, subtopics } = makeStarterConsentTopicRows('guild-1');
    expect(parents.map((topic) => topic.name)).toEqual(
      starterConsentTopics.map((topic) => topic.name),
    );
    expect(subtopics).toHaveLength(24);
    expect(new Set([...parents, ...subtopics].map((topic) => topic.id)).size).toBe(45);
    expect(
      parents.every((topic) => topic.guildId === 'guild-1' && topic.parentTopicId === null),
    ).toBe(true);
    expect(parents.every((topic) => topic.sortOrder < 0)).toBe(true);
    for (const [index, parent] of parents.entries()) {
      expect(
        subtopics.filter((topic) => topic.parentTopicId === parent.id).map((topic) => topic.name),
      ).toEqual(starterConsentTopics[index].subtopics);
    }
    expect(subtopics.every((topic) => topic.sortOrder < 0)).toBe(true);
  });
});
