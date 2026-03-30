export const NO_LIMIT = 11;

export const SESSIONS_PER_MONTH_OPTIONS = [
  { id: 0, label: '0 (Not participating)' },
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ id: n, label: n.toString() })),
  { id: NO_LIMIT, label: 'No Limit' },
];
