import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const mocks = vi.hoisted(() => ({ save: vi.fn(), reload: vi.fn(), saved: vi.fn() }));
vi.mock('@/actions/consent-group-notes', () => ({
  saveGameConsentGroupNote: mocks.save,
  getGameConsentGroupNote: mocks.reload,
}));
import GroupNoteField from '../GroupNoteField';
const props = {
  guildId: 'guild-1',
  gameId: 'game-1',
  topicId: 'topic-1',
  label: 'Group note: Topic',
  canEdit: true,
  onSaved: mocks.saved,
};
function Harness() {
  const [value, setValue] = useState({ note: 'Shared note', revision: 3 });
  return <GroupNoteField {...props} value={value} onSaved={setValue} />;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.save.mockResolvedValue({ type: 'success', data: { note: 'New group note', revision: 4 } });
  mocks.reload.mockResolvedValue({
    type: 'success',
    data: { note: 'Other coordinator update', revision: 4 },
  });
});
describe('shared group note editing', () => {
  it('reads group notes without exposing edit controls in the safe view', () => {
    render(
      <GroupNoteField
        {...props}
        canEdit={false}
        value={{ note: 'Group-facing text', revision: 1 }}
      />,
    );
    expect(screen.getByText('Group-facing text')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('uses an inline icon-only edit button after existing note text', () => {
    render(<GroupNoteField {...props} value={{ note: 'Shared note', revision: 1 }} />);
    const note = screen.getByText('Shared note');
    const edit = screen.getByRole('button', { name: 'Edit Group note: Topic' });
    expect(note.parentElement!.parentElement).toContainElement(edit);
    expect(note.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(edit).toHaveTextContent('');
    expect(edit.querySelector('svg')).not.toBeNull();
    expect(screen.queryByText('Group note: Topic')).not.toBeInTheDocument();
  });
  it('offers Add group note only for an empty editable note', async () => {
    const user = userEvent.setup();
    render(<GroupNoteField {...props} value={{ note: '', revision: 0 }} />);
    await user.click(screen.getByRole('button', { name: 'Add Group note: Topic' }));
    expect(screen.getByRole('textbox', { name: 'Group note: Topic' })).toHaveValue('');
  });
  it('edits only group-facing text with the original revision and saves immediately', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Edit Group note: Topic' }));
    const input = screen.getByRole('textbox', { name: 'Group note: Topic' });
    expect(input).toHaveValue('Shared note');
    await user.clear(input);
    await user.type(input, 'New group note');
    await user.click(screen.getByRole('button', { name: 'Save group note' }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith('guild-1', 'game-1', 'topic-1', 'New group note', 3),
    );
    expect(await screen.findByText('New group note')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('previews Markdown without saving and writes the raw draft with its revision', async () => {
    const user = userEvent.setup();
    const note = '**Shared boundary**\n\n- Check in first';
    mocks.save.mockResolvedValueOnce({ type: 'success', data: { note, revision: 4 } });
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Edit Group note: Topic' }));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, note);
    await user.click(screen.getByRole('switch', { name: 'Preview Group note: Topic' }));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(screen.getByText('Shared boundary').tagName).toBe('STRONG');
    await user.click(screen.getByRole('button', { name: 'Save group note' }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith('guild-1', 'game-1', 'topic-1', note, 3),
    );
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByText('Shared boundary').tagName).toBe('STRONG');
  });
  it('keeps a stale draft and requires an explicit discard/reload instead of overwriting', async () => {
    const user = userEvent.setup();
    mocks.save.mockResolvedValueOnce({
      type: 'failure',
      error: 'This group note changed. Your draft has been kept.',
    });
    const { rerender } = render(
      <GroupNoteField {...props} value={{ note: 'Original', revision: 3 }} />,
    );
    await user.click(screen.getByRole('button', { name: 'Edit Group note: Topic' }));
    const input = screen.getByRole('textbox', { name: 'Group note: Topic' });
    await user.clear(input);
    await user.type(input, 'My draft');
    rerender(
      <GroupNoteField {...props} value={{ note: 'Other coordinator update', revision: 4 }} />,
    );
    expect(input).toHaveValue('My draft');
    await user.click(screen.getByRole('button', { name: 'Save group note' }));
    expect(await screen.findByText(/Your draft has been kept/)).toBeInTheDocument();
    expect(input).toHaveValue('My draft');
    expect(mocks.save).toHaveBeenCalledWith('guild-1', 'game-1', 'topic-1', 'My draft', 3);
    await user.click(screen.getByRole('button', { name: 'Reload latest (discard draft)' }));
    await waitFor(() => expect(input).toHaveValue('Other coordinator update'));
    expect(mocks.saved).toHaveBeenCalledWith({ note: 'Other coordinator update', revision: 4 });
  });
  it('supports clearing and cancelling without writing private player notes', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Edit Group note: Topic' }));
    await user.clear(screen.getByRole('textbox', { name: 'Group note: Topic' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mocks.save).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Edit Group note: Topic' }));
    await user.clear(screen.getByRole('textbox', { name: 'Group note: Topic' }));
    await user.click(screen.getByRole('button', { name: 'Save group note' }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith('guild-1', 'game-1', 'topic-1', '', 3),
    );
  });
});
