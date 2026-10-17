import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }));
vi.mock('@/actions/consent-coordinators', () => ({ setConsentCoordinator: mocks.save }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
import ConsentCoordinators from '../ConsentCoordinators';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.save.mockResolvedValue({ type: 'success' });
});
describe('coordinator assignments', () => {
  it('assigns and revokes saved members using their game-scoped identity', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ConsentCoordinators
        guildId="guild-1"
        gameId="game-1"
        members={[
          { discordUserId: 'player-1', displayName: 'Player', isConsentCoordinator: false },
        ]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Assign coordinator' }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith('guild-1', 'game-1', 'player-1', true),
    );
    expect(mocks.refresh).toHaveBeenCalled();
    rerender(
      <ConsentCoordinators
        guildId="guild-1"
        gameId="game-1"
        members={[{ discordUserId: 'player-1', displayName: 'Player', isConsentCoordinator: true }]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Remove coordinator' }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenLastCalledWith('guild-1', 'game-1', 'player-1', false),
    );
  });
  it('shows server denials without changing the assignment', async () => {
    mocks.save.mockResolvedValueOnce({ type: 'failure', error: 'Access denied' });
    render(
      <ConsentCoordinators
        guildId="guild-1"
        gameId="game-1"
        members={[
          { discordUserId: 'player-1', displayName: 'Player', isConsentCoordinator: false },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Assign coordinator' }));
    expect(await screen.findByText('Access denied')).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
