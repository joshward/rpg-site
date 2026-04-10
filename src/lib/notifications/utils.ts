export function getDaysUntilEndOfMonth(date: Date): number {
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return lastDay - date.getUTCDate();
}

export function getOrdinalDate(date: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = date % 100;
  return date + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function getPrefix(): string {
  const isLocal = process.env.NODE_ENV === 'development';
  return isLocal ? '[Test Message] ' : '';
}
