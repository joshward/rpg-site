import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlayerActivityStatus from './PlayerActivityStatus';
import type { AdminMemberInactivity } from '@/actions/preferences';
import { NO_LIMIT } from '@/lib/preferences';

const activity: AdminMemberInactivity = {
  classification: 'inactive',
  lastScheduleMonth: '2025-12',
  details: {
    threshold: 3,
    evaluatedAt: '2026-04-24T12:00:00Z',
    cutoff: '2026-04-26T00:00:00Z',
    firstEligibleAt: '2025-01-15T00:00:00Z',
    additionSource: 'schedule_fallback',
    firstCountableMonth: '2025-02',
    months: ['2026-03', '2026-04', '2026-05'].map((month) => ({
      month,
      status: 'missing',
      source: null,
      completedAt: null,
    })),
    reasons: [],
  },
};
describe('automatic pause history', () => {
  it('shows actual change details independently of live preview and distinguishes unknown delivery', async () => {
    render(
      <PlayerActivityStatus
        displayName="Player"
        activity={null}
        pause={{
          current: true,
          pausedAt: '2026-04-26T18:00:00Z',
          previousSessionsPerMonth: NO_LIMIT,
          threshold: 3,
          checkedMonths: ['2026-03', '2026-04', '2026-05'],
          dmStatus: 'reserved',
        }}
      />,
    );
    await userEvent
      .setup()
      .click(
        screen.getByRole('button', { name: 'Automatically paused status details for Player' }),
      );
    expect(await screen.findByText('Desired sessions: No Limit → 0')).toBeInTheDocument();
    expect(screen.getByText(/Delivery unknown/)).toBeInTheDocument();
    expect(screen.getByText(/Mar, 26, Apr, 26, May, 26/)).toBeInTheDocument();
    expect(screen.getByText(/another pause is possible in a later cycle/)).toBeInTheDocument();
  });
  it('labels a past pause as historical rather than attributing a later voluntary preference to automation', async () => {
    render(
      <PlayerActivityStatus
        displayName="Player"
        pause={{
          current: false,
          pausedAt: '2026-04-26T18:00:00Z',
          previousSessionsPerMonth: 2,
          threshold: 3,
          checkedMonths: [],
          dmStatus: 'failed',
        }}
      />,
    );
    await userEvent
      .setup()
      .click(
        screen.getByRole('button', { name: 'Previous automatic pause status details for Player' }),
      );
    expect(
      await screen.findByText(/not the reason for the current preference/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Failed \(preference still changed\)/)).toBeInTheDocument();
  });
});

describe('colored player activity details', () => {
  it.each([
    ['active', 'Active', 'text-jade-11'],
    ['inactive', 'Inactive', 'text-ruby-11'],
    ['excluded', 'Not participating', 'text-sage-11'],
    ['new_player', 'New Player', 'text-violet-11'],
    ['uncertain', 'Unknown', 'text-amber-11'],
  ])('labels %s with an accessible colored button', (classification, label, color) => {
    render(
      <PlayerActivityStatus activity={{ ...activity, classification }} displayName="Player" />,
    );
    expect(screen.getByRole('button', { name: `${label} status details for Player` })).toHaveClass(
      color,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('click opens the checked cycles, threshold, provenance and cutoff, without claiming a downgrade happened', async () => {
    const user = userEvent.setup();
    render(<PlayerActivityStatus activity={activity} displayName="Player" />);
    expect(screen.getByText('Last schedule Dec, 25 -')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Inactive status details for Player' }));
    expect(await screen.findByRole('dialog', { name: 'Player — Inactive' })).toBeInTheDocument();
    expect(screen.getByText('Threshold: 3 unanswered cycles')).toBeInTheDocument();
    expect(screen.getByText('Mar, 26: No response')).toBeInTheDocument();
    expect(screen.getByText('May, 26: No response')).toBeInTheDocument();
    expect(screen.getByText(/guild schedule fallback \(assumed\)/)).toBeInTheDocument();
    expect(screen.getByText(/Cycle cutoff: Apr 26, 2026/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close status details' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('supports keyboard open and Escape dismissal with focus returned to the status', async () => {
    const user = userEvent.setup();
    render(<PlayerActivityStatus activity={activity} displayName="Player" />);
    const trigger = screen.getByRole('button', { name: 'Inactive status details for Player' });
    await user.tab();
    expect(trigger).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
  it('distinguishes protective legacy activity from known full admin completion', async () => {
    const user = userEvent.setup();
    const value: AdminMemberInactivity = {
      ...activity,
      classification: 'active',
      details: {
        ...activity.details,
        months: [
          { month: '2026-03', status: 'legacy_response', source: null, completedAt: null },
          {
            month: '2026-04',
            status: 'complete',
            source: 'admin',
            completedAt: '2026-04-01T00:00:00Z',
          },
        ],
      },
    };
    render(<PlayerActivityStatus activity={value} displayName="Player" />);
    await user.click(screen.getByRole('button', { name: 'Active status details for Player' }));
    expect(await screen.findByText('Mar, 26: Legacy response (protects)')).toBeInTheDocument();
    expect(screen.getByText('Apr, 26: Full submission (admin)')).toBeInTheDocument();
  });
  it('dismisses on outside click', async () => {
    const user = userEvent.setup();
    render(
      <>
        <PlayerActivityStatus activity={activity} displayName="Player" />
        <button>Outside</button>
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Inactive status details for Player' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
