import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  getTopics: vi.fn(),
  notify: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ guildId: 'guild-1' }),
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('@/actions/consent-admin', () => ({ saveConsentAdminSettings: mocks.save }));
vi.mock('@/actions/consent-topics', () => ({ getOfficialConsentTopics: mocks.getTopics }));
vi.mock('@/components/Notification', () => ({ useNotification: () => ({ add: mocks.notify }) }));

import ConsentSettings from './ConsentSettings';
import { DEFAULT_CONSENT_GUIDANCE } from '@/lib/consent/guidance';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.save.mockResolvedValue({ type: 'success', data: { enabled: true } });
  mocks.getTopics.mockResolvedValue({
    type: 'success',
    data: [{ id: 'topic-1', parentTopicId: null, name: 'Horror' }],
  });
});

describe('guild consent settings UI', () => {
  it('hides guidance while disabled and populates the default when enabled', async () => {
    render(<ConsentSettings initialEnabled={false} initialGuidance={null} />);
    const toggle = screen.getByRole('checkbox', { name: /enable consent checklists/i });
    expect(toggle).not.toBeChecked();
    expect(screen.queryByRole('textbox', { name: /checklist guidance/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/guidance preview/i)).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(toggle);
    expect(screen.queryByRole('heading', { name: /official topics/i })).not.toBeInTheDocument();
    expect(screen.getByText(/save enablement & guidance to initialize/i)).toBeInTheDocument();
    const textarea = screen.getByRole('textbox', { name: /checklist guidance/i });
    expect(textarea).toHaveValue(DEFAULT_CONSENT_GUIDANCE);
    expect(screen.queryByText('Guidance preview')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save enablement & guidance/i }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith('guild-1', true, DEFAULT_CONSENT_GUIDANCE),
    );
    expect(mocks.getTopics).toHaveBeenCalledWith('guild-1');
    expect(await screen.findByRole('heading', { name: /official topics/i })).toBeInTheDocument();
    expect(screen.getByText('Horror')).toBeInTheDocument();
    expect(toggle).toBeChecked();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('does not show topics if enabling the guild fails', async () => {
    mocks.save.mockResolvedValueOnce({ type: 'failure', error: 'Could not enable' });
    render(<ConsentSettings initialEnabled={false} initialGuidance={null} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: /enable consent checklists/i }));
    await user.click(screen.getByRole('button', { name: /save enablement & guidance/i }));
    expect(mocks.getTopics).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: /official topics/i })).not.toBeInTheDocument();
  });

  it('allows retrying topic loading without toggling the checkbox', async () => {
    mocks.getTopics.mockResolvedValueOnce({ type: 'failure', error: 'Could not load topics' });
    render(<ConsentSettings initialEnabled={false} initialGuidance={null} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: /enable consent checklists/i }));
    await user.click(screen.getByRole('button', { name: /save enablement & guidance/i }));
    expect(await screen.findByText('Could not load topics')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save enablement & guidance/i }));
    expect(await screen.findByText('Horror')).toBeInTheDocument();
    expect(mocks.getTopics).toHaveBeenCalledTimes(2);
  });

  it('shows topics inside the consent settings when consent is saved as enabled', () => {
    const { container } = render(
      <ConsentSettings
        initialEnabled={true}
        initialGuidance={null}
        initialTopics={[{ id: 'topic-1', parentTopicId: null, name: 'Horror' }]}
      />,
    );
    expect(screen.getByRole('heading', { name: /official topics/i })).toBeInTheDocument();
    expect(screen.getByText('Horror')).toBeInTheDocument();
    expect(container.firstElementChild).toContainElement(
      screen.getByRole('heading', { name: /official topics/i }),
    );
  });

  it('keeps an earlier override when disabled and enabled again', async () => {
    render(<ConsentSettings initialEnabled={false} initialGuidance="# Our guidance" />);
    const user = userEvent.setup();
    const toggle = screen.getByRole('checkbox', { name: /enable consent checklists/i });
    await user.click(toggle);
    expect(screen.getByRole('textbox', { name: /checklist guidance/i })).toHaveValue(
      '# Our guidance',
    );
    await user.click(toggle);
    expect(screen.queryByRole('textbox', { name: /checklist guidance/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save enablement & guidance/i }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith('guild-1', false, '# Our guidance'),
    );
    await user.click(toggle);
    expect(screen.getByRole('textbox', { name: /checklist guidance/i })).toHaveValue(
      '# Our guidance',
    );
    await user.click(screen.getByRole('button', { name: /restore default guidance/i }));
    expect(screen.getByRole('textbox', { name: /checklist guidance/i })).toHaveValue(
      DEFAULT_CONSENT_GUIDANCE,
    );
  });
});
