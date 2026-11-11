import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import MemberAvailabilitySummary from './MemberAvailabilitySummary';
vi.mock('../../helpers', () => ({ getContactInfo: () => ({ adminText: 'your admin' }) }));
const pause = { pausedAt: '2026-10-27T18:00:00Z' };
it('explains an automatic zero in the existing summary without blocking optional participation', () => {
  render(
    <MemberAvailabilitySummary
      guildId="a"
      games={[]}
      sessionsPerMonth={0}
      inactivityPause={pause}
    />,
  );
  expect(screen.getByText(/Availability reminders are paused/)).toBeInTheDocument();
  expect(screen.getByText(/Interested in optional games/)).toBeInTheDocument();
  expect(screen.getByText(/Saving availability won’t change/)).toBeInTheDocument();
  expect(screen.queryByText(/Your preferences are to attend/)).not.toBeInTheDocument();
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Update your desired sessions' })).toHaveAttribute(
    'href',
    '/g/a/preferences',
  );
});
it('preserves core-game warnings when automatically paused', () => {
  render(
    <MemberAvailabilitySummary
      guildId="a"
      games={[{ id: 'g', name: 'Game', sessionsPerMonth: 2, isRequired: true, status: 'active' }]}
      sessionsPerMonth={0}
      inactivityPause={pause}
    />,
  );
  expect(screen.getByText(/You are scheduled for more than your preferences/)).toBeInTheDocument();
  expect(screen.getByText(/Availability reminders are paused/)).toBeInTheDocument();
});
it('does not invent inactivity for voluntary zero or a restored preference', () => {
  const { rerender } = render(
    <MemberAvailabilitySummary guildId="a" games={[]} sessionsPerMonth={0} />,
  );
  expect(screen.queryByText(/Availability reminders are paused/)).not.toBeInTheDocument();
  rerender(
    <MemberAvailabilitySummary
      guildId="a"
      games={[]}
      sessionsPerMonth={2}
      inactivityPause={pause}
    />,
  );
  expect(screen.queryByText(/Availability reminders are paused/)).not.toBeInTheDocument();
});
it('uses admin correction links rather than the admin’s own preference page when viewing another player', () => {
  render(
    <MemberAvailabilitySummary
      guildId="a"
      games={[]}
      sessionsPerMonth={0}
      inactivityPause={pause}
      isReadOnly
    />,
  );
  expect(screen.getByText(/This member’s desired sessions were automatically/)).toBeInTheDocument();
  for (const link of screen.getAllByRole('link'))
    expect(link).toHaveAttribute('href', '/g/a/admin');
});
