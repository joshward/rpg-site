'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

// Use the browser's locale/timezone after hydration, not the server's timezone.
// A deterministic UTC fallback keeps server rendering and hydration consistent.
export default function LocalDate({ value }: { value: string }) {
  const isClient = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const date = new Date(value);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const label = isClient
    ? date.toLocaleDateString(undefined, options)
    : date.toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
  return (
    <time
      dateTime={value}
      title={isClient ? date.toLocaleString(undefined, { timeZoneName: 'short' }) : value}
    >
      {label}
    </time>
  );
}
