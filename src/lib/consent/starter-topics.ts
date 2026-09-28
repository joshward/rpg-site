// Main topics are answerable too; subtopics allow a more specific boundary.
// Keep these labels original rather than reproducing the reference checklist.
export const starterConsentTopics: readonly {
  name: string;
  subtopics: readonly string[];
}[] = [
  {
    name: 'Horror',
    subtopics: ['Insects and spiders', 'Eye and body horror', 'Supernatural or demonic imagery'],
  },
  { name: 'Graphic violence', subtopics: ['Blood and gore', 'Torture'] },
  { name: 'Harm to animals', subtopics: [] },
  { name: 'Harm to children', subtopics: [] },
  {
    name: 'Romance',
    subtopics: ['Between player characters', 'Between a player character and an NPC'],
  },
  {
    name: 'Sexual content',
    subtopics: ['Implied or off-screen intimacy', 'Explicit sexual content'],
  },
  { name: 'Sexual assault', subtopics: [] },
  { name: 'Discrimination', subtopics: ['Racism', 'Sexism', 'Homophobia and transphobia'] },
  { name: 'Cultural stereotypes', subtopics: [] },
  { name: 'Real-world religion', subtopics: [] },
  { name: 'Serious illness', subtopics: [] },
  { name: 'Gaslighting and coercion', subtopics: [] },
  { name: 'Self-harm and suicide', subtopics: ['Self-injury', 'Suicide'] },
  {
    name: 'Pregnancy and reproductive health',
    subtopics: ['Pregnancy', 'Pregnancy loss', 'Abortion'],
  },
  {
    name: 'Confinement and restraint',
    subtopics: ['Claustrophobia', 'Physical restraint or paralysis'],
  },
  { name: 'Police violence', subtopics: [] },
  { name: 'Mass violence', subtopics: ['War', 'Genocide', 'Terrorism'] },
  { name: 'Survival threats', subtopics: ['Starvation or dehydration', 'Extreme heat or cold'] },
  { name: 'Natural disasters and severe weather', subtopics: [] },
  { name: 'Death and grief', subtopics: [] },
  { name: 'Substance use and addiction', subtopics: [] },
];

export function makeStarterConsentTopicRows(guildId: string) {
  // New topics use the DB's default sort order of zero, after these initial rows.
  const parents = starterConsentTopics.map((topic, index) => ({
    id: crypto.randomUUID(),
    guildId,
    parentTopicId: null as string | null,
    name: topic.name,
    sortOrder: index - starterConsentTopics.length,
  }));
  const subtopics = parents.flatMap((parent, parentIndex) =>
    starterConsentTopics[parentIndex].subtopics.map((name, index, siblings) => ({
      id: crypto.randomUUID(),
      guildId,
      parentTopicId: parent.id as string | null,
      name,
      sortOrder: index - siblings.length,
    })),
  );
  return { parents, subtopics };
}
