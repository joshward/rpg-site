import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const mocks = vi.hoisted(() => ({ save: vi.fn(), notify: vi.fn() }));
vi.mock('next/navigation', () => ({ useParams: () => ({ guildId: 'guild-1' }) }));
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
describe('guild overview Markdown editor', () => {
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
      ),
    );
  });
});
