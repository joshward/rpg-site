import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    expect(within(header!).getByText('All good')).toBeInTheDocument();
    expect(within(header!).getByText('Veil')).toBeInTheDocument();
    expect(within(header!).getByText('Heads-up')).toBeInTheDocument();
    expect(within(header!).getByText('Veil').closest('div')?.firstElementChild).toHaveClass(
      'bg-amber-9',
      'text-amber-12',
      'dark:text-amber-1',
    );
    expect(within(header!).getByText('Heads-up').closest('div')?.firstElementChild).toHaveClass(
      'bg-plum-9',
    );
    expect(within(header!).getByText('All good').closest('div')?.firstElementChild).toHaveClass(
      'bg-jade-9',
      'text-jade-12',
      'dark:text-jade-1',
    );
    expect(
      within(header!).getByText(/I am comfortable if this content ends up on-screen/i),
    ).toBeInTheDocument();
    expect(
      within(header!).getByText(/It may exist in the world, but it won’t be part of play/i),
    ).toBeInTheDocument();
    expect(
      within(header!).getByText(/Warn me before this comes up or if it's a likely topic/i),
    ).toBeInTheDocument();
    expect(within(header!).getByText('Hard line').closest('div')?.firstElementChild).toHaveClass(
      'bg-ruby-9',
    );
    expect(within(header!).getByText(/3 topics still need an answer/i)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Horror' })).toHaveClass(
      'border-b',
      'border-sage-7/60',
    );
    expect(screen.getByRole('group', { name: 'Spiders' })).toHaveClass(
      'border-b',
      'border-sage-7/60',
    );
    expect(
      screen.queryByRole('textbox', { name: /overall private note/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Talk with your group' })).toBeInTheDocument();
    const guide = screen.getByText('Checklist guidance').closest('details');
    expect(guide).toHaveAttribute('open');
    await userEvent.setup().click(screen.getByText('Checklist guidance'));
    await waitFor(() => expect(guide).not.toHaveAttribute('open'));
  });

  it('waits beyond the expanded header before shrinking and avoids scroll-anchor flicker', () => {
    const { container } = render(<ChecklistForm guildId="guild-1" initialChecklist={checklist} />);
    const header = container.querySelector('header')!;
    const sentinel = container.querySelector('form > div[aria-hidden="true"]')!;
    Object.defineProperty(header, 'offsetHeight', { configurable: true, value: 220 });
    let distancePastStart = 0;
    vi.spyOn(sentinel, 'getBoundingClientRect').mockImplementation(
      () => ({ top: -distancePastStart }) as DOMRect,
    );
    const scrollTo = (distance: number) => {
      distancePastStart = distance;
      fireEvent.scroll(window);
    };
    const description = /It can happen, but leave it off-screen/i;
    scrollTo(220);
    expect(within(header).getByText(description)).toBeInTheDocument();
    scrollTo(245);
    expect(within(header).queryByText(description)).not.toBeInTheDocument();
    expect(header.querySelector('[aria-label="Checklist icon legend"]')).toHaveClass('justify-end');
    const veil = within(header).getByRole('button', { name: /Veil: It can happen/i });
    expect(veil).toHaveClass('items-center');
    expect(veil).toHaveAttribute('aria-expanded', 'false');
    fireEvent.mouseEnter(veil);
    expect(within(header).getByRole('tooltip')).toHaveTextContent(description);
    fireEvent.mouseLeave(veil);
    expect(within(header).queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.click(veil);
    expect(veil).toHaveAttribute('aria-expanded', 'true');
    expect(within(header).getByRole('tooltip')).toHaveTextContent(description);
    fireEvent.keyDown(veil, { key: 'Escape' });
    expect(within(header).queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.click(veil);
    expect(within(header).getByRole('tooltip')).toHaveTextContent(description);
    fireEvent.click(veil);
    expect(within(header).queryByRole('tooltip')).not.toBeInTheDocument();
    // If the browser adjusts scroll position after the header shrinks, stay compact.
    scrollTo(35);
    expect(within(header).queryByText(description)).not.toBeInTheDocument();
    scrollTo(-1);
    expect(within(header).getByText(description)).toBeInTheDocument();
    // Expanding the header must not immediately shrink it again.
    scrollTo(210);
    expect(within(header).getByText(description)).toBeInTheDocument();
  });

  it('toggles inline answer icons and saves only changed topics with their revisions', async () => {
    render(<ChecklistForm guildId="guild-1" initialChecklist={checklist} />);
    const user = userEvent.setup();
    const veil = within(screen.getByRole('group', { name: 'Horror' })).getByRole('button', {
      name: 'Veil (off-screen) for Horror',
    });
    await user.click(veil);
    expect(veil).toHaveAttribute('aria-pressed', 'true');
    expect(veil).toHaveClass('bg-amber-9', 'text-amber-12', 'dark:text-amber-1');
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

  it('shows All good while saving the existing enthusiastic response value', async () => {
    render(<ChecklistForm guildId="guild-1" initialChecklist={checklist} />);
    const user = userEvent.setup();
    const allGood = within(screen.getByRole('group', { name: 'Horror' })).getByRole('button', {
      name: 'All good for Horror',
    });
    await user.click(allGood);
    expect(allGood).toHaveClass('bg-jade-9', 'text-jade-12', 'dark:text-jade-1');
    await user.click(screen.getByRole('button', { name: /save checklist/i }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        'guild-1',
        [
          {
            topicId: 'parent',
            expectedTopicRevision: 0,
            answer: 'enthusiastic',
            headsUp: false,
            note: '',
          },
        ],
        undefined,
      ),
    );
  });

  it('uses a heads-up toggle only for Veil or All good and preserves private note-only drafts', async () => {
    render(<ChecklistForm guildId="guild-1" initialChecklist={checklist} />);
    const user = userEvent.setup();
    const horror = screen.getByRole('group', { name: 'Horror' });
    const headsUp = within(horror).getByRole('button', { name: 'Heads-up for Horror' });
    expect(headsUp).toBeDisabled();
    await user.click(within(horror).getByRole('button', { name: 'All good for Horror' }));
    expect(headsUp).toBeEnabled();
    await user.click(headsUp);
    expect(headsUp).toHaveAttribute('aria-pressed', 'true');
    expect(headsUp).toHaveClass('bg-plum-9', 'text-white');
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
    ).toHaveAttribute('href', '/g/guild-1/preferences#content-checklist');
    expect(
      within(horror).getByRole('button', { name: 'Hard line (do not include) for Horror' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /save checklist/i })).toBeEnabled();
  });
});
