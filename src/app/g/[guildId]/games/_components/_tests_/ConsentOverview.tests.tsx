import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const mocks = vi.hoisted(() => ({
  topic: vi.fn(),
  overall: vi.fn(),
  status: vi.fn(),
  noteTopics: vi.fn(),
}));
vi.mock('@/actions/consent-private-details', () => ({
  getGameConsentTopicDetails: mocks.topic,
  getGameConsentOverallNotes: mocks.overall,
  getGameConsentNoteTopics: mocks.noteTopics,
}));
vi.mock('@/actions/consent-game-status', () => ({ getGameConsentStatus: mocks.status }));
vi.mock('@/actions/consent-group-notes', () => ({
  getGameConsentGroupNote: vi.fn(),
  saveGameConsentGroupNote: vi.fn(),
}));
import ConsentOverview from '../ConsentOverview';
import { saveGameConsentGroupNote } from '@/actions/consent-group-notes';
const props = {
  guildId: 'guild-1',
  gameId: 'game-1',
  canViewPrivateDetails: true,
  topics: [
    {
      id: 'topic-1',
      name: 'Topic',
      parentTopicId: null,
      answer: 'veil' as const,
      headsUp: false,
      missingAnswers: 0,
      needsCare: true,
    },
  ],
};
const topicData = {
  type: 'success' as const,
  data: [
    {
      discordUserId: 'player-1',
      displayName: 'Player',
      answer: 'veil',
      headsUp: true,
      source: 'inherited',
      note: 'Private topic text',
      parentNote: 'Private parent text',
    },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.noteTopics.mockResolvedValue({ type: 'success', data: [] });
  mocks.topic.mockResolvedValue(topicData);
  mocks.overall.mockResolvedValue({
    type: 'success',
    data: [{ discordUserId: 'player-1', displayName: 'Player', note: 'Private overall text' }],
  });
  mocks.status.mockResolvedValue({
    type: 'success',
    data: {
      hasTopics: true,
      members: [{ discordUserId: 'player-1', displayName: 'Player', status: 'complete' }],
    },
  });
});

describe('private detail mode', () => {
  it('never offers unlock or loads private data for ordinary members', () => {
    render(<ConsentOverview {...props} canViewPrivateDetails={false} />);
    expect(
      screen.queryByRole('button', { name: 'Unlock private details' }),
    ).not.toBeInTheDocument();
    expect(mocks.topic).not.toHaveBeenCalled();
    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.overall).not.toHaveBeenCalled();
    expect(mocks.noteTopics).not.toHaveBeenCalled();
  });
  it('keeps shared group notes visible while locking edit controls behind private mode', async () => {
    const user = userEvent.setup();
    render(
      <ConsentOverview
        {...props}
        overallGroupNote={{ note: 'Shared overall note', revision: 1 }}
        topics={[
          {
            ...props.topics[0],
            answer: 'enthusiastic',
            needsCare: false,
            groupNote: { note: 'Shared topic note', revision: 2 },
          },
        ]}
      />,
    );
    expect(screen.getByText('Shared overall note')).toBeInTheDocument();
    expect(screen.getByText('Shared topic note')).toBeInTheDocument();
    expect(screen.queryByText('All good from everyone (1)')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit Group note: Topic' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Unlock private details' }));
    expect(screen.getByRole('button', { name: 'Edit Group note: Topic' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide all private details' }));
    expect(screen.getByText('Shared topic note')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit Group note: Topic' }),
    ).not.toBeInTheDocument();
  });

  it('publishes a saved group note into Needs care and keeps it visible after relocking', async () => {
    const user = userEvent.setup();
    vi.mocked(saveGameConsentGroupNote).mockResolvedValueOnce({
      type: 'success',
      data: { note: 'Group translation', revision: 1 },
    });
    render(
      <ConsentOverview
        {...props}
        topics={[{ ...props.topics[0], answer: 'enthusiastic', needsCare: false }]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Unlock private details' }));
    await user.click(screen.getByText('All good from everyone (1)'));
    await user.click(screen.getByRole('button', { name: 'Add Group note: Topic' }));
    expect(screen.getByRole('textbox', { name: 'Group note: Topic' })).toHaveValue('');
    await user.type(
      screen.getByRole('textbox', { name: 'Group note: Topic' }),
      'Group translation',
    );
    await user.click(screen.getByRole('button', { name: 'Save group note' }));
    expect(await screen.findByText('Group translation')).toBeInTheDocument();
    expect(screen.queryByText('All good from everyone (1)')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide all private details' }));
    expect(screen.getByText('Group translation')).toBeInTheDocument();
    expect(mocks.topic).not.toHaveBeenCalled();
  });

  it('places contribution status first and groups the overall editor with private player notes', async () => {
    const user = userEvent.setup();
    render(
      <ConsentOverview {...props} overallGroupNote={{ note: 'Shared overall', revision: 1 }} />,
    );
    await user.click(screen.getByRole('button', { name: 'Unlock private details' }));
    const heading = screen.getByRole('heading', { name: 'Overall group notes' });
    const overall = within(heading.parentElement!);
    expect(
      screen.getByRole('button', { name: 'Contribution status' }).compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      heading.compareDocumentPosition(screen.getByRole('heading', { name: 'Needs care' })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(mocks.overall).not.toHaveBeenCalled();
    await user.click(overall.getByRole('button', { name: 'Overall private player notes' }));
    expect(await overall.findByText('Private overall text')).toBeInTheDocument();
    await user.click(overall.getByRole('button', { name: 'Edit Overall game group note' }));
    await user.type(overall.getByRole('textbox'), ' unsaved draft');
    await user.click(overall.getByRole('switch', { name: 'Preview Overall game group note' }));
    expect(overall.getByRole('region')).toHaveTextContent('unsaved draft');
    await user.click(screen.getByRole('button', { name: 'Hide all private details' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText('Private overall text')).not.toBeInTheDocument();
    expect(screen.getByText('Shared overall')).toBeInTheDocument();
  });

  it('places topic group notes below status labels in the same right-hand column', () => {
    render(
      <ConsentOverview
        {...props}
        topics={[{ ...props.topics[0], groupNote: { note: 'Shared topic', revision: 1 } }]}
      />,
    );
    const badge = screen.getByText('Veiled');
    const statusColumn = badge.parentElement!.parentElement!;
    const note = within(statusColumn).getByText('Shared topic');
    expect(badge.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(statusColumn).queryByRole('heading', { name: 'Topic' })).not.toBeInTheDocument();
  });

  it('loads each pane only after explicit unlock and expansion, then hides/discards all on lock', async () => {
    const user = userEvent.setup();
    render(<ConsentOverview {...props} />);
    expect(screen.queryByRole('button', { name: 'Contribution status' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Unlock private details' }));
    expect(screen.getByText('Private details visible')).toBeInTheDocument();
    expect(mocks.topic).not.toHaveBeenCalled();
    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.overall).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Full details: Topic' }));
    expect(await screen.findByText('Private topic text', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Inherited from parent topic')).toBeInTheDocument();
    expect(mocks.topic).toHaveBeenCalledWith('guild-1', 'game-1', 'topic-1');
    await user.click(screen.getByRole('button', { name: 'Contribution status' }));
    expect(await screen.findByText('Complete')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Overall private player notes' }));
    expect(await screen.findByText('Private overall text')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide all private details' }));
    expect(screen.queryByText('Private topic text', { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText('Private overall text')).not.toBeInTheDocument();
    expect(screen.queryByText('Complete')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Unlock private details' }));
    expect(screen.queryByText('Private topic text', { exact: false })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Full details: Topic' }));
    await waitFor(() => expect(mocks.topic).toHaveBeenCalledTimes(2));
  });
  it('toggles the purple topic panel from the row without refetching other open panels', async () => {
    const user = userEvent.setup();
    render(
      <ConsentOverview
        {...props}
        topics={[props.topics[0], { ...props.topics[0], id: 'topic-2', name: 'Other topic' }]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Unlock private details' }));
    const control = screen.getByRole('button', { name: 'Full details: Topic' });
    const row = within(control.closest('li')!);
    expect(
      row.getByRole('heading', { name: 'Topic' }).compareDocumentPosition(control) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      control.compareDocumentPosition(row.getByText('Veiled')) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(control).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('private-topic-topic-1')).toBeNull();
    await user.click(control);
    await screen.findByText('Private topic text', { exact: false });
    expect(control).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('private-topic-topic-1')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Full details: Other topic' }));
    await waitFor(() => expect(mocks.topic).toHaveBeenCalledTimes(2));
    await user.click(control);
    expect(control).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('private-topic-topic-1')).toBeNull();
    expect(mocks.topic).toHaveBeenCalledTimes(2);
  });

  it('ignores private responses that arrive after relocking', async () => {
    const user = userEvent.setup();
    let resolve: (value: typeof topicData) => void = () => {};
    mocks.topic.mockReturnValueOnce(
      new Promise<typeof topicData>((done) => {
        resolve = done;
      }),
    );
    render(<ConsentOverview {...props} />);
    await user.click(screen.getByRole('button', { name: 'Unlock private details' }));
    await user.click(screen.getByRole('button', { name: 'Full details: Topic' }));
    await user.click(screen.getByRole('button', { name: 'Hide all private details' }));
    await act(async () => resolve(topicData));
    expect(screen.queryByText('Private topic text', { exact: false })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Unlock private details' }));
    expect(screen.queryByText('Private topic text', { exact: false })).not.toBeInTheDocument();
  });
  it('ignores late note metadata after relocking', async () => {
    const user = userEvent.setup();
    let resolve: (value: { type: 'success'; data: string[] }) => void = () => {};
    mocks.noteTopics.mockReturnValueOnce(
      new Promise<{ type: 'success'; data: string[] }>((done) => {
        resolve = done;
      }),
    );
    render(<ConsentOverview {...props} />);
    await user.click(screen.getByRole('button', { name: 'Unlock private details' }));
    await user.click(screen.getByRole('button', { name: 'Hide all private details' }));
    await act(async () => resolve({ type: 'success', data: ['topic-1'] }));
    expect(screen.queryByText('Private notes')).not.toBeInTheDocument();
  });

  it('relocks if a later private read is denied and drops other loaded panes', async () => {
    const user = userEvent.setup();
    mocks.status.mockResolvedValueOnce({ type: 'failure', error: 'No longer a coordinator' });
    render(<ConsentOverview {...props} />);
    await user.click(screen.getByRole('button', { name: 'Unlock private details' }));
    await user.click(screen.getByRole('button', { name: 'Full details: Topic' }));
    await screen.findByText('Private topic text', { exact: false });
    await user.click(screen.getByRole('button', { name: 'Contribution status' }));
    expect(await screen.findByText(/Private details could not be loaded/)).toBeInTheDocument();
    expect(screen.queryByText('Private topic text', { exact: false })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unlock private details' })).toBeInTheDocument();
  });
  it('stays unlocked when switching browser tabs', async () => {
    const user = userEvent.setup();
    render(<ConsentOverview {...props} />);
    await user.click(screen.getByRole('button', { name: 'Unlock private details' }));
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => window.dispatchEvent(new Event('blur')));
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    visibility.mockRestore();
    expect(screen.getByText('Private details visible')).toBeInTheDocument();
  });

  it('promotes All good topics with private notes to Needs care only after unlock', async () => {
    const user = userEvent.setup();
    mocks.noteTopics.mockResolvedValue({ type: 'success', data: ['topic-1'] });
    render(
      <ConsentOverview
        {...props}
        topics={[{ ...props.topics[0], answer: 'enthusiastic', needsCare: false }]}
      />,
    );
    expect(screen.getByText('All good from everyone (1)')).toBeInTheDocument();
    expect(mocks.noteTopics).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Unlock private details' }));
    expect(await screen.findByText('Private notes')).toBeInTheDocument();
    expect(screen.queryByText('All good from everyone (1)')).not.toBeInTheDocument();
    expect(mocks.topic).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Hide all private details' }));
    expect(screen.queryByText('Private notes')).not.toBeInTheDocument();
    expect(screen.getByText('All good from everyone (1)')).toBeInTheDocument();
  });

  it('does not persist unlock across leaving the page or remounting', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ConsentOverview {...props} />);
    await user.click(screen.getByRole('button', { name: 'Unlock private details' }));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(screen.getByRole('button', { name: 'Unlock private details' })).toBeInTheDocument();
    unmount();
    render(<ConsentOverview {...props} />);
    expect(screen.queryByText('Private details visible')).not.toBeInTheDocument();
  });
});
