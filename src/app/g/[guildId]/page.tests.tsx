import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ prompt: vi.fn(), info: vi.fn() }));
vi.mock('@/actions/consent-prompt', () => ({ getMyConsentPrompt: mocks.prompt }));
vi.mock('@/actions/guilds', () => ({ getGuildInfo: mocks.info }));
vi.mock('@/actions/preferences', () => ({
  getMyPreference: async () => ({ type: 'success', data: { sessionsPerMonth: 2 } }),
}));
vi.mock('@/actions/games', () => ({ getMyGames: async () => ({ type: 'success', data: [] }) }));
vi.mock('@/actions/availability', () => ({ getMyAvailability: vi.fn() }));
vi.mock('@/lib/availability', () => ({
  getNextMonth: () => ({ year: 2026, month: 11 }),
  isLast10DaysOfCurrentMonth: () => false,
}));
vi.mock('./helpers', () => ({
  getGuildName: vi.fn(),
  getContactInfo: () => ({ adminText: 'admin' }),
}));
vi.mock('./_components/UserGameList', () => ({ default: () => <div>Your games</div> }));
vi.mock('./_components/UserSchedule', () => ({ default: () => null }));
import GuildPage from './page';
const props = { params: Promise.resolve({ guildId: 'guild-1' }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.info.mockResolvedValue({ type: 'success', data: { consentChecklistAvailable: true } });
  mocks.prompt.mockResolvedValue({ type: 'success', data: true });
});
describe('guild overview checklist prompt', () => {
  it('renders one banner linking directly to the checklist', async () => {
    render(await GuildPage(props));
    expect(screen.getAllByRole('link', { name: 'Please complete your checklist.' })).toHaveLength(
      1,
    );
    expect(screen.getByRole('link', { name: 'Please complete your checklist.' })).toHaveAttribute(
      'href',
      '/g/guild-1/preferences#content-checklist',
    );
  });
  it('does not read completion when consent is unavailable', async () => {
    mocks.info.mockResolvedValueOnce({
      type: 'success',
      data: { consentChecklistAvailable: false },
    });
    render(await GuildPage(props));
    expect(mocks.prompt).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('link', { name: 'Please complete your checklist.' }),
    ).not.toBeInTheDocument();
  });
  it.each([
    { type: 'success', data: false },
    { type: 'failure', error: 'Unavailable' },
  ])('does not invent a prompt on a false/failed eligibility read', async (result) => {
    mocks.prompt.mockResolvedValueOnce(result);
    render(await GuildPage(props));
    expect(
      screen.queryByRole('link', { name: 'Please complete your checklist.' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Your games')).toBeInTheDocument();
  });
});
