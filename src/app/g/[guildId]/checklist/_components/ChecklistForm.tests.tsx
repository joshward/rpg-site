import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({ save: vi.fn(), notify: vi.fn() }));
vi.mock('@/actions/consent-checklist', () => ({ saveMyConsentChecklist: mocks.save }));
vi.mock('@/components/Notification', () => ({ useNotification: () => ({ add: mocks.notify }) }));

import ChecklistForm, { type ChecklistData } from './ChecklistForm';

const checklist: ChecklistData = {
  topics: [
    { id: 'parent', parentTopicId: null, name: 'Horror', revision: 0 },
    { id: 'child', parentTopicId: 'parent', name: 'Spiders', revision: 0 },
    { id: 'other', parentTopicId: null, name: 'Violence', revision: 2 },
  ],
  responses: [],
  guidance: '# Talk with your group',
  overallNote: null,
  complete: false,
  missingTopicIds: ['parent', 'child', 'other'],
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.save.mockResolvedValue({ type: 'success', data: undefined });
});

describe('player content checklist', () => {
  it('keeps the icon legend and Save in a sticky header above compact topic rows', async () => {
    const { container } = render(<ChecklistForm guildId="guild-1" initialChecklist={checklist} />);
    const header = container.querySelector('header');
    expect(header).toHaveClass('sticky', 'top-0');
    expect(within(header!).getByRole('button', { name: /save checklist/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(within(header!).getByText('Enthusiastic')).toBeInTheDocument();
    expect(within(header!).getByText('Veil')).toBeInTheDocument();
    expect(within(header!).getByText('Heads-up')).toBeInTheDocument();
    expect(within(header!).getByText(/3 topics still need an answer/i)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Horror' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Spiders' })).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: /overall private note/i }),
    ).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByText('Checklist guidance'));
    expect(screen.getByRole('heading', { name: 'Talk with your group' })).toBeInTheDocument();
  });

  it('toggles inline answer icons and saves only changed topics with their revisions', async () => {
    render(<ChecklistForm guildId="guild-1" initialChecklist={checklist} />);
    const user = userEvent.setup();
    const veil = within(screen.getByRole('group', { name: 'Horror' })).getByRole('button', {
      name: 'Veil (off-screen) for Horror',
    });
    await user.click(veil);
    expect(veil).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/1 topic still needs an answer/i)).toBeInTheDocument();
    await user.click(veil);
    expect(veil).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/3 topics still need an answer/i)).toBeInTheDocument();
    await user.click(veil);
    await user.click(screen.getByRole('button', { name: /save checklist/i }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        'guild-1',
        [{ topicId: 'parent', expectedTopicRevision: 0, answer: 'veil', headsUp: false, note: '' }],
        undefined,
      ),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(/checklist saved/i);
    expect(screen.getByRole('button', { name: /save checklist/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('uses a heads-up toggle only for Veil or Enthusiastic and preserves private note-only drafts', async () => {
    render(<ChecklistForm guildId="guild-1" initialChecklist={checklist} />);
    const user = userEvent.setup();
    const horror = screen.getByRole('group', { name: 'Horror' });
    const headsUp = within(horror).getByRole('button', { name: 'Heads-up for Horror' });
    expect(headsUp).toBeDisabled();
    await user.click(
      within(horror).getByRole('button', { name: 'Enthusiastic consent for Horror' }),
    );
    expect(headsUp).toBeEnabled();
    await user.click(headsUp);
    expect(headsUp).toHaveAttribute('aria-pressed', 'true');
    await user.click(
      within(horror).getByRole('button', { name: 'Hard line (do not include) for Horror' }),
    );
    expect(headsUp).toBeDisabled();
    expect(headsUp).toHaveAttribute('aria-pressed', 'false');
    await user.click(
      within(horror).getByRole('button', { name: 'Hard line (do not include) for Horror' }),
    );
    expect(
      within(horror).getByRole('button', { name: 'Add private note for Horror' }),
    ).toHaveAttribute('aria-expanded', 'false');
    await user.click(within(horror).getByRole('button', { name: 'Add private note for Horror' }));
    await user.type(
      within(horror).getByRole('textbox', { name: /private note for horror/i }),
      'Please discuss first',
    );
    expect(
      within(horror).getByRole('button', { name: 'Edit private note for Horror' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(horror).getByRole('button', { name: 'Edit private note for Horror' }),
    ).toHaveClass('bg-violet-9');
    await user.click(screen.getByRole('button', { name: /save checklist/i }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        'guild-1',
        [
          {
            topicId: 'parent',
            expectedTopicRevision: 0,
            answer: null,
            headsUp: false,
            note: 'Please discuss first',
          },
        ],
        undefined,
      ),
    );
  });

  it('opens the optional overall note editor and saves it without rewriting topic answers', async () => {
    render(<ChecklistForm guildId="guild-1" initialChecklist={checklist} />);
    const user = userEvent.setup();
    const noteButton = screen.getByRole('button', { name: 'Add overall private note' });
    await user.click(noteButton);
    expect(noteButton).toHaveAttribute('aria-expanded', 'true');
    await user.type(
      screen.getByRole('textbox', { name: /overall private note/i }),
      'Private context',
    );
    await user.click(screen.getByRole('button', { name: /save checklist/i }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('guild-1', [], 'Private context'));
  });

  it('shows stale-save errors in the sticky header without losing edits', async () => {
    mocks.save.mockResolvedValueOnce({
      type: 'failure',
      error: 'A topic changed. Reload your checklist before saving.',
    });
    const { container } = render(<ChecklistForm guildId="guild-1" initialChecklist={checklist} />);
    const user = userEvent.setup();
    const horror = screen.getByRole('group', { name: 'Horror' });
    await user.click(
      within(horror).getByRole('button', { name: 'Hard line (do not include) for Horror' }),
    );
    await user.click(screen.getByRole('button', { name: /save checklist/i }));
    const header = container.querySelector('header')!;
    expect(
      await within(header).findByRole('link', { name: /reload your checklist/i }),
    ).toHaveAttribute('href', '/g/guild-1/checklist');
    expect(
      within(horror).getByRole('button', { name: 'Hard line (do not include) for Horror' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /save checklist/i })).toBeEnabled();
  });
});
