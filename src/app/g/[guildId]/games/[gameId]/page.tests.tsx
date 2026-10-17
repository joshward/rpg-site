import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  game: vi.fn(),
  members: vi.fn(),
  channels: vi.fn(),
  notFound: vi.fn(),
  form: vi.fn(),
}));
vi.mock('@/actions/guilds', () => ({
  getGuildInfo: mocks.info,
  getGuildChannelsAction: mocks.channels,
}));
vi.mock('@/actions/games', () => ({ getGame: mocks.game, getEligibleGameMembers: mocks.members }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('../../helpers', () => ({ getGuildName: vi.fn() }));
vi.mock('../_components/ConsentCoordinators', () => ({
  default: () => <div>Coordinator assignments</div>,
}));
vi.mock('../_components/GameForm', () => ({
  default: (props: { showConsentMode: boolean; initialData: { consentMode: string } }) => {
    mocks.form(props);
    return <div>Game editor</div>;
  },
}));

import EditGamePage from './page';

const props = { params: Promise.resolve({ guildId: 'guild-1', gameId: 'game-1' }) };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.info.mockResolvedValue({
    type: 'success',
    data: { role: 'admin', consentChecklistAvailable: true },
  });
  mocks.game.mockResolvedValue({ type: 'success', data: { name: 'Game', consentMode: 'off' } });
  mocks.members.mockResolvedValue({ type: 'success', data: [] });
  mocks.channels.mockResolvedValue({ type: 'success', data: [] });
  mocks.notFound.mockImplementation(() => {
    throw new Error('not found');
  });
});

afterEach(() => vi.unstubAllEnvs());

describe('edit game page consent dropdown', () => {
  it('hides consent controls when the server feature, guild or impersonation hides them', async () => {
    mocks.info.mockResolvedValueOnce({
      type: 'success',
      data: { role: 'admin', consentChecklistAvailable: false },
    });
    render(await EditGamePage(props));
    expect(screen.getByText('Game editor')).toBeInTheDocument();
    expect(mocks.form).toHaveBeenCalledWith(expect.objectContaining({ showConsentMode: false }));
  });

  it('passes the saved mode to the main game form for enabled guild admins', async () => {
    mocks.game.mockResolvedValueOnce({
      type: 'success',
      data: { name: 'Game', consentMode: 'requested' },
    });
    render(await EditGamePage(props));
    expect(mocks.form).toHaveBeenCalledWith(
      expect.objectContaining({
        showConsentMode: true,
        initialData: expect.objectContaining({ consentMode: 'requested' }),
      }),
    );
  });

  it('links to status only when the feature, guild and game mode all allow it', async () => {
    vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
    mocks.game.mockResolvedValueOnce({
      type: 'success',
      data: { name: 'Game', consentMode: 'optional', members: [] },
    });
    render(await EditGamePage(props));
    expect(screen.getByRole('link', { name: 'View consent status' })).toHaveAttribute(
      'href',
      '/g/guild-1/games/game-1/consent',
    );
  });

  it('does not link to status for an Off game even when guild consent is enabled', async () => {
    vi.stubEnv('CONSENT_FEATURE_ENABLED', 'true');
    render(await EditGamePage(props));
    expect(screen.queryByRole('link', { name: 'View consent status' })).not.toBeInTheDocument();
  });

  it('denies non-admin access before fetching a game', async () => {
    mocks.info.mockResolvedValueOnce({ type: 'success', data: { role: 'member' } });
    await expect(EditGamePage(props)).rejects.toThrow('not found');
    expect(mocks.game).not.toHaveBeenCalled();
  });
});
