import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PreferencesForm from './PreferencesForm';
const mocks = vi.hoisted(() => ({ save: vi.fn(), add: vi.fn(), refresh: vi.fn(), track: vi.fn() }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ guildId: 'a' }),
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('@/actions/preferences', () => ({ setMyPreference: mocks.save }));
vi.mock('@/components/Notification', () => ({ useNotification: () => ({ add: mocks.add }) }));
vi.mock('next-plausible', () => ({ usePlausible: () => mocks.track }));
vi.mock('@/components/FormComboBox', () => ({
  FormComboBox: ({
    items,
    value,
    onValueChange,
  }: {
    items: { id: number; label: string }[];
    value: { id: number } | null;
    onValueChange: (value: unknown) => void;
  }) => (
    <select
      aria-label="Sessions Per Month"
      value={value?.id ?? ''}
      onChange={(event) =>
        onValueChange(items.find((item) => item.id === Number(event.target.value)))
      }
    >
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.label}
        </option>
      ))}
    </select>
  ),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue({ type: 'success' });
});
const pause = { pausedAt: '2026-10-27T18:00:00Z' };
it('uses the existing selector and explains both return steps without automatically restoring a value', () => {
  render(<PreferencesForm initialSessionsPerMonth={0} inactivityPause={pause} />);
  expect(screen.getByRole('combobox')).toHaveValue('0');
  expect(screen.getByText(/Choose your desired sessions below/)).toBeInTheDocument();
  expect(screen.getByText(/Submitting availability won’t change/)).toBeInTheDocument();
  expect(mocks.save).not.toHaveBeenCalled();
});
it('hides the pause only after a successful save and links from success feedback to availability', async () => {
  render(<PreferencesForm initialSessionsPerMonth={0} inactivityPause={pause} />);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('a', 2));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  expect(screen.queryByText(/Availability reminders are paused/)).not.toBeInTheDocument();
  render(mocks.add.mock.calls[0][0].description);
  expect(screen.getByRole('link', { name: 'Fill out your availability' })).toHaveAttribute(
    'href',
    '/g/a/availability',
  );
});
it('keeps the explanation visible if saving fails', async () => {
  mocks.save.mockResolvedValue({ type: 'failure', error: 'Not saved' });
  render(<PreferencesForm initialSessionsPerMonth={0} inactivityPause={pause} />);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }));
  await waitFor(() => expect(mocks.add).toHaveBeenCalled());
  expect(screen.getByText(/Availability reminders are paused/)).toBeInTheDocument();
  expect(mocks.refresh).not.toHaveBeenCalled();
});
it('does not add an inactivity explanation for voluntary zero', () => {
  render(<PreferencesForm initialSessionsPerMonth={0} />);
  expect(screen.queryByText(/Availability reminders are paused/)).not.toBeInTheDocument();
});
