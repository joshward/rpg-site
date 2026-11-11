import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
const mocks = vi.hoisted(() => ({
  prompt: vi.fn(),
  info: vi.fn(),
  preference: vi.fn(),
  games: vi.fn(),
  availability: vi.fn(),
  window: vi.fn(),
}));
vi.mock('@/actions/consent-prompt', () => ({ getMyConsentPrompt: mocks.prompt }));
vi.mock('@/actions/guilds', () => ({ getGuildInfo: mocks.info }));
vi.mock('@/actions/preferences', () => ({
  getMyPreference: mocks.preference,
}));
vi.mock('@/actions/games', () => ({ getMyGames: mocks.games }));
vi.mock('@/actions/availability', () => ({ getMyAvailability: mocks.availability }));
vi.mock('@/lib/availability', () => ({
  getNextMonth: () => ({ year: 2026, month: 11 }),
  isLast10DaysOfCurrentMonth: mocks.window,
  formatMonthYear: () => 'November 2026',
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
  mocks.preference.mockResolvedValue({
    type: 'success',
    data: { sessionsPerMonth: 2, inactivityPause: null },
  });
  mocks.games.mockResolvedValue({ type: 'success', data: [] });
  mocks.window.mockReturnValue(false);
});
describe('guild overview inactivity explanation', () => {
  it('replaces the generic zero message and does not duplicate the availability prompt', async () => {
    mocks.preference.mockResolvedValue({
      type: 'success',
      data: { sessionsPerMonth: 0, inactivityPause: { pausedAt: '2026-10-27T18:00:00Z' } },
    });
    mocks.window.mockReturnValue(true);
    mocks.availability.mockResolvedValue({ type: 'success', data: null });
    render(await GuildPage(props));
    expect(screen.getByText(/Availability reminders are paused/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Update your desired sessions' })).toHaveAttribute(
      'href',
      '/g/guild-1/preferences',
    );
    expect(screen.getByRole('link', { name: 'fill out your availability' })).toHaveAttribute(
      'href',
      '/g/guild-1/availability',
    );
    expect(screen.queryByText(/You are currently set as/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Go to Availability' })).not.toBeInTheDocument();
  });
  it('preserves the core-game warning alongside the automatic-pause explanation', async () => {
    mocks.preference.mockResolvedValue({
      type: 'success',
      data: { sessionsPerMonth: 0, inactivityPause: { pausedAt: '2026-10-27T18:00:00Z' } },
    });
    mocks.games.mockResolvedValue({
      type: 'success',
      data: [{ status: 'active', isRequired: true, sessionsPerMonth: 2 }],
    });
    render(await GuildPage(props));
    expect(screen.getByText(/Availability reminders are paused/)).toBeInTheDocument();
    expect(screen.getByText(/core participant in games totalling more days/)).toBeInTheDocument();
  });
  it('keeps voluntary zero neutral, without an invented inactivity explanation', async () => {
    mocks.preference.mockResolvedValue({
      type: 'success',
      data: { sessionsPerMonth: 0, inactivityPause: null },
    });
    render(await GuildPage(props));
    expect(screen.getByText('not participating')).toBeInTheDocument();
    expect(screen.queryByText(/Availability reminders are paused/)).not.toBeInTheDocument();
  });
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
