import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ info: vi.fn(), checklist: vi.fn(), notFound: vi.fn() }));
vi.mock('@/actions/guilds', () => ({ getGuildInfo: mocks.info }));
vi.mock('@/actions/consent-checklist', () => ({ getMyConsentChecklist: mocks.checklist }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('./_components/ChecklistForm', () => ({
  default: () => <div>Private checklist form</div>,
}));
vi.mock('../helpers', () => ({ getGuildName: vi.fn() }));

import ChecklistPage from './page';

const props = { params: Promise.resolve({ guildId: 'guild-1' }) };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.notFound.mockImplementation(() => {
    throw new Error('not found');
  });
  mocks.info.mockResolvedValue({ type: 'success', data: { consentChecklistAvailable: true } });
  mocks.checklist.mockResolvedValue({ type: 'success', data: { topics: [] } });
});

describe('private checklist route', () => {
  it('does not load private data when the gate, guild or impersonation hides the page', async () => {
    mocks.info.mockResolvedValueOnce({
      type: 'success',
      data: { consentChecklistAvailable: false },
    });
    await expect(ChecklistPage(props)).rejects.toThrow('not found');
    expect(mocks.checklist).not.toHaveBeenCalled();
  });

  it('does not render private data if the self-only action denies access', async () => {
    mocks.checklist.mockResolvedValueOnce({ type: 'failure', error: 'Access denied' });
    render(await ChecklistPage(props));
    expect(screen.getByText('Access denied')).toBeInTheDocument();
    expect(screen.queryByText('Private checklist form')).not.toBeInTheDocument();
  });

  it('renders only the authenticated player checklist result', async () => {
    render(await ChecklistPage(props));
    expect(screen.getByText('Private checklist form')).toBeInTheDocument();
    expect(mocks.checklist).toHaveBeenCalledWith('guild-1');
  });
});
