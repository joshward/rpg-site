import { afterEach, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import LocalDate from '../LocalDate';

const value = '2026-11-11T00:30:00Z';
afterEach(() => vi.restoreAllMocks());

function simulateBrowserTimezone() {
  const format = Date.prototype.toLocaleDateString;
  vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (
    this: Date,
    locales,
    options,
  ) {
    return format.call(this, locales, {
      ...options,
      timeZone: options?.timeZone ?? 'America/Los_Angeles',
    });
  });
}

it('renders the viewer’s local date across UTC midnight while retaining the original timestamp', () => {
  simulateBrowserTimezone();
  render(<LocalDate value={value} />);
  const expected = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Los_Angeles',
  }).format(new Date(value));
  expect(screen.getByText(expected)).toHaveAttribute('datetime', value);
  expect(screen.queryByText('Nov 11, 2026')).not.toBeInTheDocument();
});

it('hydrates consistently from the server fallback, then switches to the browser timezone', async () => {
  simulateBrowserTimezone();
  const errors = vi.spyOn(console, 'error');
  const container = document.createElement('div');
  container.innerHTML = renderToString(<LocalDate value={value} />);
  expect(container.textContent).toBe('Nov 11, 2026');
  document.body.appendChild(container);
  let root: Root;
  await act(async () => {
    root = hydrateRoot(container, <LocalDate value={value} />);
  });
  expect(container.querySelector('time')).toHaveTextContent('Nov 10, 2026');
  expect(errors).not.toHaveBeenCalled();
  await act(async () => root.unmount());
  container.remove();
});
