import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({ save: vi.fn(), notify: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ guildId: 'guild-1' }),
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('@/actions/consent-admin', () => ({ saveConsentAdminSettings: mocks.save }));
vi.mock('@/components/Notification', () => ({ useNotification: () => ({ add: mocks.notify }) }));

import ConsentSettings from './ConsentSettings';
import { DEFAULT_CONSENT_GUIDANCE } from '@/lib/consent/guidance';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.save.mockResolvedValue({ type: 'success', data: { enabled: true } });
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
    const textarea = screen.getByRole('textbox', { name: /checklist guidance/i });
    expect(textarea).toHaveValue(DEFAULT_CONSENT_GUIDANCE);
    expect(screen.queryByText('Guidance preview')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save enablement & guidance/i }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith('guild-1', true, DEFAULT_CONSENT_GUIDANCE),
    );
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
