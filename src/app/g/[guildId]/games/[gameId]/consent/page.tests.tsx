import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ info: vi.fn(), status: vi.fn(), notFound: vi.fn() }));
vi.mock('@/actions/guilds', () => ({ getGuildInfo: mocks.info }));
vi.mock('@/actions/consent-game-status', () => ({ getGameConsentStatus: mocks.status }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));

import GameConsentStatusPage from './page';

const props = { params: Promise.resolve({ guildId: 'guild-1', gameId: 'game-1' }) };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.notFound.mockImplementation(() => {
    throw new Error('not found');
  });
  mocks.info.mockResolvedValue({
    type: 'success',
    data: { role: 'admin', consentChecklistAvailable: true },
  });
  mocks.status.mockResolvedValue({
    type: 'success',
    data: {
      gameName: 'Game',
      mode: 'requested',
      hasTopics: true,
      members: [{ discordUserId: 'user-1', displayName: 'Player', status: 'complete' }],
    },
  });
});

describe('game consent status page', () => {
  it('denies non-admins and hidden guild/feature/impersonation before fetching status', async () => {
    mocks.info.mockResolvedValueOnce({
      type: 'success',
      data: { role: 'member', consentChecklistAvailable: true },
    });
    await expect(GameConsentStatusPage(props)).rejects.toThrow('not found');
    mocks.info.mockResolvedValueOnce({
      type: 'success',
      data: { role: 'admin', consentChecklistAvailable: false },
    });
    await expect(GameConsentStatusPage(props)).rejects.toThrow('not found');
    mocks.info.mockResolvedValueOnce({ type: 'failure', error: 'Unauthorized' });
    await expect(GameConsentStatusPage(props)).rejects.toThrow('not found');
    expect(mocks.status).not.toHaveBeenCalled();
  });

  it('does not render a game when the server read rejects its mode or guild', async () => {
    mocks.status.mockResolvedValueOnce({ type: 'failure', error: 'Not available' });
    await expect(GameConsentStatusPage(props)).rejects.toThrow('not found');
  });

  it('renders only completion status for an authorized game', async () => {
    render(await GameConsentStatusPage(props));
    expect(mocks.status).toHaveBeenCalledWith('guild-1', 'game-1');
    expect(screen.getByRole('heading', { name: 'Consent status: Game' })).toBeInTheDocument();
    expect(screen.getByText('Player')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.queryByText('private note')).not.toBeInTheDocument();
  });

  it('shows an empty game without inventing completion statuses', async () => {
    mocks.status.mockResolvedValueOnce({
      type: 'success',
      data: { gameName: 'Game', mode: 'optional', hasTopics: true, members: [] },
    });
    render(await GameConsentStatusPage(props));
    expect(screen.getByText('No members are assigned to this game yet.')).toBeInTheDocument();
    expect(screen.queryByText('Complete')).not.toBeInTheDocument();
  });

  it('shows an unconfigured message without marking members complete', async () => {
    mocks.status.mockResolvedValueOnce({
      type: 'success',
      data: { gameName: 'Game', mode: 'optional', hasTopics: false, members: [] },
    });
    render(await GameConsentStatusPage(props));
    expect(screen.getByText('Official consent topics are not configured yet.')).toBeInTheDocument();
    expect(screen.queryByText('Complete')).not.toBeInTheDocument();
  });
});
