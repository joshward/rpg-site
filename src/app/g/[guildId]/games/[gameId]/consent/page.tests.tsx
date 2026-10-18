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
    expect(
      screen.getByRole('heading', { name: 'Content Consent Overview: Game' }),
    ).toBeInTheDocument();
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

  it('places coordinator navigation after content boundaries', async () => {
    mocks.aggregate.mockResolvedValueOnce({
      type: 'success',
      data: {
        gameName: 'Game',
        mode: 'requested',
        canViewContributions: true,
        topics: [
          {
            id: 'topic-1',
            name: 'Topic',
            parentTopicId: null,
            answer: 'veil',
            headsUp: false,
            missingAnswers: 0,
            needsCare: true,
          },
        ],
      },
    });
    render(await GameConsentAggregatePage(props));
    const topic = screen.getByRole('heading', { name: 'Topic' });
    const navigation = screen.getByRole('link', { name: 'Contribution status' });
    expect(
      topic.compareDocumentPosition(navigation) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
