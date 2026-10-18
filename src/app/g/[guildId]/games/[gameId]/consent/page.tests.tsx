import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ aggregate: vi.fn(), notFound: vi.fn(), overview: vi.fn() }));
vi.mock('@/actions/consent-aggregate', () => ({ getGameConsentAggregate: mocks.aggregate }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('../../_components/ConsentOverview', () => ({
  default: (props: unknown) => {
    mocks.overview(props);
    return <div>Safe aggregate</div>;
  },
}));
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
describe('overview initial server render', () => {
  it('passes only safe aggregate props and a capability flag, never private data', async () => {
    render(await GameConsentAggregatePage(props));
    expect(
      screen.getByRole('heading', { name: 'Content Consent Overview: Game' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review or change my checklist' })).toHaveAttribute(
      'href',
      '/g/guild-1/preferences#content-checklist',
    );
    expect(mocks.overview).toHaveBeenCalledWith({
      guildId: 'guild-1',
      gameId: 'game-1',
      topics: [],
      canViewPrivateDetails: false,
    });
  });
  it('lets a coordinator unlock on the client, without server-preloading private data', async () => {
    mocks.aggregate.mockResolvedValueOnce({
      type: 'success',
      data: { gameName: 'Game', topics: [], canViewContributions: true },
    });
    render(await GameConsentAggregatePage(props));
    expect(mocks.overview).toHaveBeenCalledWith(
      expect.objectContaining({ canViewPrivateDetails: true }),
    );
    expect(screen.queryByRole('link', { name: 'Contribution status' })).not.toBeInTheDocument();
  });
  it('denies unauthorized overview navigation', async () => {
    mocks.aggregate.mockResolvedValueOnce({ type: 'failure', error: 'Denied' });
    await expect(GameConsentAggregatePage(props)).rejects.toThrow('not found');
    expect(mocks.overview).not.toHaveBeenCalled();
  });
});
