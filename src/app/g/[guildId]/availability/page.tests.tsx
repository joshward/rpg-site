import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ info: vi.fn(), prompt: vi.fn() }));
vi.mock('@/actions/guilds', () => ({ getGuildInfo: mocks.info }));
vi.mock('@/actions/consent-prompt', () => ({ getMyConsentPrompt: mocks.prompt }));
vi.mock('@/actions/auth-helpers', () => ({
  ensureAccess: async () => ({ role: 'admin', discordAccount: { userId: 'self' } }),
}));
vi.mock('@/actions/availability', () => ({
  getMyAvailability: async () => ({ type: 'success', data: null }),
  getAdminMemberAvailability: async () => ({ type: 'success', data: null }),
}));
vi.mock('@/actions/preferences', () => ({
  getMyPreference: async () => ({ type: 'success', data: { sessionsPerMonth: null } }),
  getAdminMemberPreference: async () => ({ type: 'success', data: { sessionsPerMonth: null } }),
}));
vi.mock('@/actions/games', () => ({ getMemberGames: async () => ({ type: 'success', data: [] }) }));
vi.mock('@/lib/discord/api', () => ({ getGuildMembers: async () => [] }));
vi.mock('../helpers', () => ({ getGuildName: vi.fn() }));
vi.mock('./_components/AvailabilityView', () => ({ default: () => <div>Availability</div> }));
vi.mock('./_components/MonthNav', () => ({ default: () => null }));
vi.mock('./_components/MemberAvailabilitySummary', () => ({ default: () => null }));
import AvailabilityPage from './page';

const props = {
  params: Promise.resolve({ guildId: 'guild-1' }),
  searchParams: Promise.resolve({}),
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.info.mockResolvedValue({ type: 'success', data: { consentChecklistAvailable: true } });
  mocks.prompt.mockResolvedValue({ type: 'success', data: true });
});
describe('availability checklist prompt', () => {
  it('uses the same banner and checklist link for the signed-in player', async () => {
    render(await AvailabilityPage(props));
    expect(
      screen.getByText("One or more of the games you're in request a completed content checklist."),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Please complete your checklist.' })).toHaveAttribute(
      'href',
      '/g/guild-1/preferences#content-checklist',
    );
    expect(mocks.prompt).toHaveBeenCalledWith('guild-1');
  });
  it('does not read completion when editing another member', async () => {
    render(
      await AvailabilityPage({ ...props, searchParams: Promise.resolve({ userId: 'other' }) }),
    );
    expect(mocks.prompt).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('link', { name: 'Please complete your checklist.' }),
    ).not.toBeInTheDocument();
  });
  it('does not read completion when consent is hidden', async () => {
    mocks.info.mockResolvedValueOnce({
      type: 'success',
      data: { consentChecklistAvailable: false },
    });
    render(await AvailabilityPage(props));
    expect(mocks.prompt).not.toHaveBeenCalled();
  });
  it('hides the banner after completion', async () => {
    mocks.prompt.mockResolvedValueOnce({ type: 'success', data: false });
    render(await AvailabilityPage(props));
    expect(
      screen.queryByRole('link', { name: 'Please complete your checklist.' }),
    ).not.toBeInTheDocument();
  });
});
