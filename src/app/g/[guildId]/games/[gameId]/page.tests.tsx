import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('denies non-admin access before fetching a game', async () => {
    mocks.info.mockResolvedValueOnce({ type: 'success', data: { role: 'member' } });
    await expect(EditGamePage(props)).rejects.toThrow('not found');
    expect(mocks.game).not.toHaveBeenCalled();
  });
});
