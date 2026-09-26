import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
  notify: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useParams: () => ({ guildId: 'guild-1' }) }));
vi.mock('@/actions/consent-topics', () => ({
  addOfficialConsentTopic: mocks.add,
  renameOfficialConsentTopic: mocks.rename,
  deleteOfficialConsentTopic: mocks.remove,
}));
vi.mock('@/components/Notification', () => ({ useNotification: () => ({ add: mocks.notify }) }));

import ConsentTopicEditor from './ConsentTopicEditor';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.add.mockResolvedValue({
    type: 'success',
    data: { id: 'child-1', name: 'Eyeballs', parentTopicId: 'parent-1' },
  });
  mocks.rename.mockResolvedValue({ type: 'success', data: undefined });
});

describe('official topic editor', () => {
  it('adds a subtopic under an existing parent', async () => {
    const user = userEvent.setup();
    render(
      <ConsentTopicEditor
        initialTopics={[{ id: 'parent-1', name: 'Horror', parentTopicId: null }]}
      />,
    );
    expect(screen.queryByRole('textbox', { name: /new subtopic/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add subtopic/i }));
    await user.type(screen.getByRole('textbox', { name: /new subtopic/i }), 'Eyeballs{Enter}');
    await waitFor(() => expect(mocks.add).toHaveBeenCalledWith('guild-1', 'Eyeballs', 'parent-1'));
    expect(screen.getByText('Eyeballs')).toBeInTheDocument();
  });

  it('adds a main topic from the plus button at the end of the list', async () => {
    mocks.add.mockResolvedValueOnce({
      type: 'success',
      data: { id: 'parent-1', name: 'Horror', parentTopicId: null },
    });
    render(<ConsentTopicEditor initialTopics={[]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /add topic/i }));
    await user.type(screen.getByRole('textbox', { name: /new main topic/i }), 'Horror');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(mocks.add).toHaveBeenCalledWith('guild-1', 'Horror', null));
    expect(screen.getByText('Horror')).toBeInTheDocument();
  });

  it('prevents saving an identical main topic, ignoring case and whitespace', async () => {
    const user = userEvent.setup();
    render(
      <ConsentTopicEditor
        initialTopics={[{ id: 'parent-1', name: 'Horror', parentTopicId: null }]}
      />,
    );
    await user.click(screen.getByRole('button', { name: /add topic/i }));
    await user.type(screen.getByRole('textbox', { name: /new main topic/i }), '  horror  ');
    expect(screen.getByRole('alert')).toHaveTextContent('already exists');
    expect(screen.getByRole('button', { name: /^save$/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.type(screen.getByRole('textbox', { name: /new main topic/i }), '{Enter}');
    expect(mocks.add).not.toHaveBeenCalled();
  });

  it('switching between Add and Rename closes the other inline editor', async () => {
    const user = userEvent.setup();
    render(
      <ConsentTopicEditor
        initialTopics={[{ id: 'parent-1', name: 'Horror', parentTopicId: null }]}
      />,
    );
    await user.click(screen.getByRole('button', { name: /add subtopic/i }));
    expect(screen.getByRole('textbox', { name: /new subtopic/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /rename/i }));
    expect(screen.queryByRole('textbox', { name: /new subtopic/i })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /rename topic/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add topic/i }));
    expect(screen.queryByRole('textbox', { name: /rename topic/i })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /new main topic/i })).toBeInTheDocument();
  });

  it('requires an explicit answer choice before renaming', async () => {
    const user = userEvent.setup();
    render(
      <ConsentTopicEditor
        initialTopics={[{ id: 'parent-1', name: 'Horror', parentTopicId: null }]}
      />,
    );
    await user.click(screen.getByRole('button', { name: /rename/i }));
    expect(screen.getByRole('button', { name: /save rename/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(screen.getByRole('radio', { name: /keep answers/i }));
    await user.clear(screen.getByRole('textbox', { name: /rename topic/i }));
    await user.type(screen.getByRole('textbox', { name: /rename topic/i }), 'Fear');
    await user.click(screen.getByRole('button', { name: /save rename/i }));
    await waitFor(() =>
      expect(mocks.rename).toHaveBeenCalledWith('guild-1', 'parent-1', 'Fear', 'keep'),
    );
    expect(screen.getByText('Fear')).toBeInTheDocument();
  });
});
