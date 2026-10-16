import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  enabled: vi.fn(),
  preference: vi.fn(),
  info: vi.fn(),
  checklist: vi.fn(),
}));
vi.mock('@/lib/consent/feature-gate', () => ({ isConsentFeatureEnabled: mocks.enabled }));
vi.mock('@/actions/preferences', () => ({ getMyPreference: mocks.preference }));
vi.mock('@/actions/guilds', () => ({ getGuildInfo: mocks.info }));
vi.mock('@/actions/consent-checklist', () => ({ getMyConsentChecklist: mocks.checklist }));
vi.mock('../helpers', () => ({ getGuildName: vi.fn() }));
vi.mock('./_components/PreferencesForm', () => ({
  default: () => <div>Session preferences form</div>,
}));
vi.mock('./_components/ChecklistForm', () => ({
  default: () => <div>Private checklist form</div>,
}));

import PreferencesPage from './page';

const props = { params: Promise.resolve({ guildId: 'guild-1' }) };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled.mockReturnValue(true);
  mocks.preference.mockResolvedValue({ type: 'success', data: { sessionsPerMonth: 2 } });
  mocks.info.mockResolvedValue({ type: 'success', data: { consentChecklistAvailable: true } });
  mocks.checklist.mockResolvedValue({ type: 'success', data: { topics: [] } });
});

describe('guild preferences', () => {
  it('never loads private checklist data when the server feature flag is off', async () => {
    mocks.enabled.mockReturnValue(false);
    render(await PreferencesPage(props));
    expect(screen.getByText('Session preferences form')).toBeInTheDocument();
    expect(screen.queryByText('Private checklist form')).not.toBeInTheDocument();
    expect(mocks.info).not.toHaveBeenCalled();
    expect(mocks.checklist).not.toHaveBeenCalled();
  });

  it('does not load private data when the guild setting is off or the user is impersonating', async () => {
    mocks.info.mockResolvedValueOnce({
      type: 'success',
      data: { consentChecklistAvailable: false },
    });
    render(await PreferencesPage(props));
    expect(mocks.checklist).not.toHaveBeenCalled();
    expect(screen.queryByText('Private checklist form')).not.toBeInTheDocument();
  });

  it('does not fetch private data when the guild access check fails', async () => {
    mocks.info.mockResolvedValueOnce({ type: 'failure', error: 'Access denied' });
    render(await PreferencesPage(props));
    expect(screen.getByText('Session preferences form')).toBeInTheDocument();
    expect(mocks.checklist).not.toHaveBeenCalled();
  });

  it('does not expose checklist data when its self-only action denies access', async () => {
    mocks.checklist.mockResolvedValueOnce({ type: 'failure', error: 'Access denied' });
    render(await PreferencesPage(props));
    expect(screen.getByText('Access denied')).toBeInTheDocument();
    expect(screen.queryByText('Private checklist form')).not.toBeInTheDocument();
  });

  it('shows the authenticated player checklist beneath session preferences', async () => {
    render(await PreferencesPage(props));
    expect(screen.getByText('Session preferences form')).toBeInTheDocument();
    expect(screen.getByText('Private checklist form')).toBeInTheDocument();
    expect(mocks.checklist).toHaveBeenCalledWith('guild-1');
  });
});
