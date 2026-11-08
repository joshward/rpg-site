import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const mocks = vi.hoisted(() => ({ save: vi.fn(), notify: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ guildId: 'guild-1' }),
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('@/actions/guilds', () => ({
  saveGuildConfig: mocks.save,
  checkBotPermissionsAction: vi.fn(),
}));
vi.mock('@/components/Notification', () => ({ useNotification: () => ({ add: mocks.notify }) }));
vi.mock('@/components/FormComboBox', () => ({ FormComboBox: () => null }));
import GuildAdminForm from './GuildAdminForm';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.save.mockResolvedValue({ type: 'success' });
});
describe('guild settings form', () => {
  it('edits toggle/threshold as drafts and saves them together with the main form', async () => {
    const user = userEvent.setup();
    render(
      <GuildAdminForm
        roles={[{ id: 'members', label: 'Members' }]}
        initialAllowedRoles={['members']}
        channels={[]}
      />,
    );
    const toggle = screen.getByRole('switch', { name: 'Enable inactive player management' });
    const threshold = screen.getByRole('spinbutton', { name: 'Unanswered submission cycles' });
    expect(threshold).toBeDisabled();
    await user.click(toggle);
    expect(threshold).toBeEnabled();
    await user.clear(threshold);
    await user.type(threshold, '5');
    expect(mocks.save).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.save.mock.calls[0].at(-1)).toEqual({ enabled: true, threshold: 5 });
    expect(mocks.refresh).toHaveBeenCalledOnce();
    await user.click(toggle);
    expect(threshold).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
    expect(mocks.save.mock.calls[1].at(-1)).toEqual({ enabled: false, threshold: 5 });
  });
  it('does not refresh saved user statuses after a failed settings save', async () => {
    const user = userEvent.setup();
    mocks.save.mockResolvedValue({ type: 'failure', error: 'Save failed' });
    render(
      <GuildAdminForm
        roles={[{ id: 'members', label: 'Members' }]}
        initialAllowedRoles={['members']}
        channels={[]}
      />,
    );
    await user.click(screen.getByRole('switch', { name: 'Enable inactive player management' }));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() =>
      expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })),
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it('preserves raw Markdown across previews and only saves with Save Changes', async () => {
    const user = userEvent.setup();
    render(
      <GuildAdminForm
        roles={[{ id: 'members', label: 'Members' }]}
        initialAllowedRoles={['members']}
        channels={[]}
        initialOverviewText="# Welcome"
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Overview Text' });
    expect(input).toHaveValue('# Welcome');
    await user.type(input, '\n\n**Guild update**');
    await user.click(screen.getByRole('switch', { name: 'Preview Overview Text' }));
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
    expect(screen.getByText('Guild update').tagName).toBe('STRONG');
    expect(mocks.save).not.toHaveBeenCalled();
    await user.click(screen.getByRole('switch', { name: 'Preview Overview Text' }));
    expect(screen.getByRole('textbox', { name: 'Overview Text' })).toHaveValue(
      '# Welcome\n\n**Guild update**',
    );
    await user.click(screen.getByRole('switch', { name: 'Preview Overview Text' }));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        'guild-1',
        ['members'],
        undefined,
        undefined,
        '',
        undefined,
        undefined,
        undefined,
        undefined,
        '# Welcome\n\n**Guild update**',
        '',
        { enabled: false, threshold: 3 },
      ),
    );
  });
});
