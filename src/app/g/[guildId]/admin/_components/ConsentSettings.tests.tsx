import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({ save: vi.fn(), notify: vi.fn() }));
vi.mock('next/navigation', () => ({ useParams: () => ({ guildId: 'guild-1' }) }));
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
    const textarea = screen.getByRole('textbox', { name: /checklist guidance/i });
    expect(textarea).toHaveValue(DEFAULT_CONSENT_GUIDANCE);
    expect(screen.getByRole('heading', { name: 'Content boundaries' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save consent settings/i }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith('guild-1', true, DEFAULT_CONSENT_GUIDANCE),
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
    await user.click(screen.getByRole('button', { name: /save consent settings/i }));
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
