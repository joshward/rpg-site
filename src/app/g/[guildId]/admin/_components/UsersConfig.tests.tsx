import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UsersConfig from './UsersConfig';

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  set: vi.fn(),
  notify: vi.fn(),
  push: vi.fn(),
  plausible: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ guildId: 'guild-1' }),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@/actions/preferences', () => ({
  getAdminMemberPreferences: mocks.load,
  setAdminMemberPreference: mocks.set,
}));
vi.mock('@/actions/auth-actions', () => ({ startImpersonation: vi.fn() }));
vi.mock('@/components/Notification', () => ({ useNotification: () => ({ add: mocks.notify }) }));
vi.mock('next-plausible', () => ({ usePlausible: () => mocks.plausible }));

function members() {
  return ['active', 'inactive', 'excluded', 'new_player', 'uncertain'].map((classification, i) => ({
    discordUserId: String(i),
    username: `player${i}`,
    displayName: `Player ${i}`,
    hasLoggedIn: false,
    lastLoginAt: null,
    sessionsPerMonth: i === 2 ? 0 : 2,
    inactivity: {
      classification,
      lastScheduleMonth: i === 0 ? '2026-04' : null,
      details: {
        evaluatedAt: '2026-04-26T00:00:00Z',
        threshold: 3,
        cutoff: '2026-04-26T00:00:00Z',
        firstCountableMonth: '2025-02',
        firstEligibleAt: '2025-01-15T00:00:00Z',
        additionSource: 'schedule_fallback',
        months: [],
        reasons: [],
      },
    },
  }));
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.load.mockResolvedValue({ type: 'success', data: members() });
});

describe('Users Config inactivity snapshot', () => {
  it('shows concise colored status buttons beneath preferences only when enabled', async () => {
    render(<UsersConfig inactivityEnabled />);
    fireEvent.click(screen.getByRole('button', { name: /Users Config/ }));
    expect(await screen.findByText('Last schedule Apr, 26 -')).toBeInTheDocument();
    for (const [i, label] of [
      'Active',
      'Inactive',
      'Not participating',
      'New Player',
      'Unknown',
    ].entries()) {
      expect(
        screen.getByRole('button', { name: `${label} status details for Player ${i}` }),
      ).toBeInTheDocument();
    }
    expect(screen.queryByText('Inactivity preview')).not.toBeInTheDocument();
    expect(mocks.load).toHaveBeenCalledWith('guild-1');
  });
  it('hides all status data and any open tooltip when disabled', async () => {
    const user = userEvent.setup();
    const view = render(<UsersConfig inactivityEnabled />);
    await user.click(screen.getByRole('button', { name: /Users Config/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Active status details for Player 0' }),
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    view.rerender(<UsersConfig inactivityEnabled={false} />);
    expect(screen.queryByText(/Last schedule/)).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Player 0')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /status details for/ })).not.toBeInTheDocument();
  });
  it('reloads on saved settings changes without collapsing Users Config', async () => {
    const view = render(<UsersConfig inactivityEnabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Users Config/ }));
    await screen.findByText('Player 0');
    expect(screen.queryByText(/Last schedule/)).not.toBeInTheDocument();
    view.rerender(<UsersConfig inactivityEnabled inactivityThreshold={3} />);
    await screen.findByRole('button', { name: 'Active status details for Player 0' });
    view.rerender(<UsersConfig inactivityEnabled inactivityThreshold={4} />);
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(3));
    expect(screen.getByRole('button', { name: /Users Config/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});
