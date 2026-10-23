import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import type { ComboboxOption } from '@/components/Combobox';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  push: vi.fn(),
  notify: vi.fn(),
  plausible: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ guildId: 'guild-1' }),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('next-plausible', () => ({ usePlausible: () => mocks.plausible }));
vi.mock('@/actions/games', () => ({
  createGame: mocks.create,
  updateGame: mocks.update,
  deleteGame: vi.fn(),
}));
vi.mock('@/actions/guilds', () => ({ checkBotPermissionsAction: vi.fn() }));
vi.mock('@/components/Notification', () => ({ useNotification: () => ({ add: mocks.notify }) }));
vi.mock('@/components/FormComboBox', () => ({
  FormComboBox: ({
    label,
    items,
    value,
    onValueChange,
    error,
  }: {
    label: string;
    items: ComboboxOption[];
    value: ComboboxOption | null;
    onValueChange: (value: ComboboxOption | null) => void;
    error?: string;
  }) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={value?.id ?? ''}
        onChange={(event) =>
          onValueChange(items.find((item) => item.id === event.target.value) ?? null)
        }
      >
        <option value="">No selection</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      {error && <span role="alert">{error}</span>}
    </label>
  ),
}));
vi.mock('@/components/FormInput', () => ({
  FormInput: ({
    label,
    value,
    onChange,
  }: {
    label?: string;
    value?: string | number;
    onChange?: ComponentProps<'input'>['onChange'];
  }) => (
    <label>
      {label}
      <input aria-label={label} value={value ?? ''} onChange={onChange} />
    </label>
  ),
}));
vi.mock('@/components/Combobox', () => ({ default: () => <div /> }));
vi.mock('@/components/ConfirmDialog', () => ({ default: () => null }));

import GameForm from '../GameForm';

const game = {
  id: 'game-1',
  name: 'Campaign',
  description: null,
  status: 'draft' as const,
  consentMode: 'requested' as const,
  sessionsPerMonth: 2,
  discordChannelId: null,
  discordChannelName: null,
  scheduleNotificationChannelId: null,
  scheduleNotificationChannelName: null,
  schedulingDetails: null,
  members: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockResolvedValue({ type: 'success', data: { id: 'new-game' } });
  mocks.update.mockResolvedValue({ type: 'success', data: { id: 'game-1' } });
});

describe('game form consent dropdown', () => {
  it('saves a chosen mode with the rest of a new game', async () => {
    render(<GameForm eligibleMembers={[]} channels={[]} showConsentMode />);
    const user = userEvent.setup();
    expect(screen.getByRole('combobox', { name: 'Consent Mode' })).toHaveValue('off');
    await user.type(screen.getByRole('textbox', { name: 'Game Name' }), 'New campaign');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Consent Mode' }), 'optional');
    await user.click(screen.getByRole('button', { name: 'Create Game' }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        'guild-1',
        expect.objectContaining({
          name: 'New campaign',
          consentMode: 'optional',
        }),
      ),
    );
  });

  it('previews the reusable description editor without submitting and saves its raw Markdown', async () => {
    const user = userEvent.setup();
    render(
      <GameForm
        initialData={{ ...game, description: '**Campaign**' }}
        eligibleMembers={[]}
        channels={[]}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'Description (Markdown)' }), ' notes');
    await user.click(screen.getByRole('switch', { name: 'Preview Description (Markdown)' }));
    expect(screen.getByText('Campaign', { selector: 'strong' })).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Update Game' }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        'guild-1',
        'game-1',
        expect.objectContaining({ description: '**Campaign** notes' }),
      ),
    );
  });

  it('keeps a saved mode when changing it in the main edit form', async () => {
    render(<GameForm initialData={game} eligibleMembers={[]} channels={[]} showConsentMode />);
    const user = userEvent.setup();
    expect(screen.getByRole('combobox', { name: 'Consent Mode' })).toHaveValue('requested');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Consent Mode' }), 'off');
    await user.click(screen.getByRole('button', { name: 'Update Game' }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        'guild-1',
        'game-1',
        expect.objectContaining({ consentMode: 'off' }),
      ),
    );
  });

  it('shows a required error instead of submitting a cleared status', async () => {
    render(<GameForm initialData={game} eligibleMembers={[]} channels={[]} showConsentMode />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), '');
    expect(await screen.findByRole('alert')).toHaveTextContent('Status is required.');
    await user.click(screen.getByRole('button', { name: 'Update Game' }));
    expect(mocks.update).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'active');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Game' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
  });

  it('requires a chosen consent mode when the field is shown', async () => {
    render(<GameForm initialData={game} eligibleMembers={[]} channels={[]} showConsentMode />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Consent Mode' }), '');
    expect(await screen.findByRole('alert')).toHaveTextContent('Consent mode is required.');
    await user.click(screen.getByRole('button', { name: 'Update Game' }));
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('clears optional channels without blocking the game save', async () => {
    render(
      <GameForm
        initialData={{ ...game, discordChannelId: 'channel-1' }}
        eligibleMembers={[]}
        channels={[{ id: 'channel-1', label: 'general' }]}
      />,
    );
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Discord Channel' }), '');
    await user.click(screen.getByRole('button', { name: 'Update Game' }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        'guild-1',
        'game-1',
        expect.objectContaining({ discordChannelId: null }),
      ),
    );
  });

  it('saves member coordinator switches only with Update Game', async () => {
    const user = userEvent.setup();
    render(
      <GameForm
        initialData={{
          ...game,
          members: [{ discordUserId: 'player-1', isRequired: true, isConsentCoordinator: false }],
        }}
        eligibleMembers={[
          { discordUserId: 'player-1', username: 'Player', displayName: 'Player', avatar: null },
        ]}
        channels={[]}
        showConsentMode
      />,
    );
    await user.click(screen.getByRole('switch', { name: 'Consent coordinator: Player' }));
    expect(mocks.update).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Update Game' }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        'guild-1',
        'game-1',
        expect.objectContaining({
          members: [{ discordUserId: 'player-1', isRequired: true, isConsentCoordinator: true }],
        }),
      ),
    );
  });

  it('hides and omits member coordinator flags when guild consent is unavailable', async () => {
    const user = userEvent.setup();
    render(
      <GameForm
        initialData={{
          ...game,
          members: [{ discordUserId: 'player-1', isRequired: true, isConsentCoordinator: true }],
        }}
        eligibleMembers={[
          { discordUserId: 'player-1', username: 'Player', displayName: 'Player', avatar: null },
        ]}
        channels={[]}
      />,
    );
    expect(screen.queryByRole('switch', { name: /Consent coordinator/ })).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Game Name' }), ' Updated');
    await user.click(screen.getByRole('button', { name: 'Update Game' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][2].members[0]).not.toHaveProperty('isConsentCoordinator');
  });

  it('omits mode from a normal game save when the control is hidden', async () => {
    render(
      <GameForm initialData={game} eligibleMembers={[]} channels={[]} showConsentMode={false} />,
    );
    const user = userEvent.setup();
    expect(screen.queryByRole('combobox', { name: 'Consent Mode' })).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Game Name' }), ' Updated');
    await user.click(screen.getByRole('button', { name: 'Update Game' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][2]).not.toHaveProperty('consentMode');
  });
});
