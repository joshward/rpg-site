function toArray(values: string | string[] | undefined): string[] {
  if (!values) {
    return [];
  }

  return Array.isArray(values) ? values : [values];
}

export function getDefaultMetadata({ subtitles }: { subtitles?: string | string[] } = {}) {
  return {
    title: toArray(subtitles).concat('Tavern Master').join(' - '),
    description: 'A discord app for managing rpg groups',
  };
}
