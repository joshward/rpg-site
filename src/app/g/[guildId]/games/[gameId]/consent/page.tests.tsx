import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ aggregate: vi.fn(), notFound: vi.fn() }));
vi.mock('@/actions/consent-aggregate', () => ({ getGameConsentAggregate: mocks.aggregate }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
import GameConsentAggregatePage from './page';
const props = { params: Promise.resolve({ guildId: 'guild-1', gameId: 'game-1' }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.notFound.mockImplementation(() => {
    throw new Error('not found');
  });
  mocks.aggregate.mockResolvedValue({
    type: 'success',
    data: { gameName: 'Game', mode: 'requested', topics: [], canViewContributions: false },
  });
});
describe('aggregate page', () => {
  it('renders only data authorized by the server read', async () => {
    render(await GameConsentAggregatePage(props));
    expect(mocks.aggregate).toHaveBeenCalledWith('guild-1', 'game-1');
    expect(screen.getByRole('heading', { name: 'Consent overview: Game' })).toBeInTheDocument();
    expect(screen.getByText('Official consent topics are not configured yet.')).toBeInTheDocument();
  });
  it('shows contribution navigation only for coordinators', async () => {
    mocks.aggregate.mockResolvedValueOnce({
      type: 'success',
      data: { gameName: 'Game', mode: 'requested', topics: [], canViewContributions: true },
    });
    render(await GameConsentAggregatePage(props));
    expect(screen.getByRole('link', { name: 'Contribution status' })).toHaveAttribute(
      'href',
      '/g/guild-1/games/game-1/consent/contributions',
    );
  });

  it('does not show coordinator drill-down to ordinary Requested members', async () => {
    render(await GameConsentAggregatePage(props));
    expect(screen.queryByRole('link', { name: 'Contribution status' })).not.toBeInTheDocument();
  });

  it('rejects direct route navigation when the server denies access', async () => {
    mocks.aggregate.mockResolvedValueOnce({ type: 'failure', error: 'Denied' });
    await expect(GameConsentAggregatePage(props)).rejects.toThrow('not found');
  });
});
