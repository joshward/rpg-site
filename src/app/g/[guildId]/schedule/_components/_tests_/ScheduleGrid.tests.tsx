import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScheduleGrid from '../ScheduleGrid';

const {
  mockAddNotification,
  mockPlausible,
  mockRefresh,
  mockSaveMonthSchedule,
  mockGetScheduleNotificationDialogData,
  mockSendScheduleNotifications,
} = vi.hoisted(() => ({
  mockAddNotification: vi.fn(),
  mockPlausible: vi.fn(),
  mockRefresh: vi.fn(),
  mockSaveMonthSchedule: vi.fn(),
  mockGetScheduleNotificationDialogData: vi.fn(),
  mockSendScheduleNotifications: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

vi.mock('next-plausible', () => ({
  usePlausible: () => mockPlausible,
}));

vi.mock('@/components/Notification', () => ({
  useNotification: () => ({
    add: mockAddNotification,
  }),
}));

vi.mock('@/lib/scoring', () => ({
  getOptimalDays: () => new Set<number>(),
}));

vi.mock('@/actions/games', () => ({
  saveMonthSchedule: mockSaveMonthSchedule,
}));

vi.mock('@/actions/schedule-notifications', () => ({
  getScheduleNotificationDialogData: mockGetScheduleNotificationDialogData,
  sendScheduleNotifications: mockSendScheduleNotifications,
}));

describe('ScheduleGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSaveMonthSchedule.mockResolvedValue({
      type: 'success',
      data: {
        changedGameIds: ['game-1'],
      },
    });

    mockGetScheduleNotificationDialogData.mockResolvedValue({
      type: 'success',
      data: {
        year: 2026,
        month: 5,
        games: [
          {
            gameId: 'game-1',
            gameName: 'Game One',
            scheduledDays: [1, 7],
            scheduledDayCount: 2,
            scheduleNotificationChannelId: 'channel-1',
            scheduleNotificationChannelName: 'schedule-updates',
            hasPriorNotificationThisMonth: false,
            alreadySentThisMonth: false,
            lastSentAt: null,
            uneditedSinceLastNotification: false,
            changedSinceLastNotification: false,
            defaultSelected: true,
            disabled: false,
            disabledReason: null,
            stateReason: null,
          },
          {
            gameId: 'game-2',
            gameName: 'Game Two',
            scheduledDays: [],
            scheduledDayCount: 0,
            scheduleNotificationChannelId: null,
            scheduleNotificationChannelName: null,
            hasPriorNotificationThisMonth: false,
            alreadySentThisMonth: false,
            lastSentAt: null,
            uneditedSinceLastNotification: false,
            changedSinceLastNotification: false,
            defaultSelected: false,
            disabled: true,
            disabledReason: 'No notification channel configured',
            stateReason: null,
          },
        ],
      },
    });

    mockSendScheduleNotifications.mockResolvedValue({
      type: 'success',
      data: {
        year: 2026,
        month: 5,
        results: [
          {
            gameId: 'game-1',
            gameName: 'Game One',
            status: 'sent',
            reason: null,
          },
        ],
      },
    });
  });

  const baseProps = {
    guildId: 'guild-1',
    target: { year: 2026, month: 5 },
    now: { year: 2026, month: 5 },
    highlightUserId: undefined,
  };

  it('hides optional zero-preference members without schedule while keeping core members visible', () => {
    render(
      <ScheduleGrid
        {...baseProps}
        games={[
          {
            id: 'game-1',
            name: 'Game One',
            status: 'active',
            sessionsPerMonth: 2,
            scheduledDays: [],
            members: [
              {
                discordUserId: 'user-opt-zero-empty',
                displayName: 'Optional Zero Empty',
                avatar: null,
                sessionsPerMonth: 0,
                availability: {},
                isRequired: false,
              },
              {
                discordUserId: 'user-opt-zero-filled',
                displayName: 'Optional Zero Filled',
                avatar: null,
                sessionsPerMonth: 0,
                availability: { 1: 'available' },
                isRequired: false,
              },
              {
                discordUserId: 'user-core-zero-empty',
                displayName: 'Core Zero Empty',
                avatar: null,
                sessionsPerMonth: 0,
                availability: {},
                isRequired: true,
              },
            ],
          },
        ]}
        unassignedMembers={[]}
      />,
    );

    expect(screen.queryByText('Optional Zero Empty')).not.toBeInTheDocument();
    expect(screen.getByText('Optional Zero Filled')).toBeInTheDocument();
    expect(screen.getByText('Core Zero Empty')).toBeInTheDocument();
  });

  it('hides unassigned section when all unassigned members are zero-preference without schedule', () => {
    render(
      <ScheduleGrid
        {...baseProps}
        games={[]}
        unassignedMembers={[
          {
            discordUserId: 'user-unassigned-zero-empty',
            displayName: 'Unassigned Zero Empty',
            avatar: null,
            sessionsPerMonth: 0,
            availability: {},
          },
        ]}
      />,
    );

    expect(screen.queryByText('Unassigned Players')).not.toBeInTheDocument();
    expect(screen.queryByText('Unassigned Zero Empty')).not.toBeInTheDocument();
  });

  it('shows unassigned section when a zero-preference unassigned member has schedule filled out', () => {
    render(
      <ScheduleGrid
        {...baseProps}
        games={[]}
        unassignedMembers={[
          {
            discordUserId: 'user-unassigned-zero-filled',
            displayName: 'Unassigned Zero Filled',
            avatar: null,
            sessionsPerMonth: 0,
            availability: { 2: 'available' },
          },
        ]}
      />,
    );

    expect(screen.getByText('Unassigned Players')).toBeInTheDocument();
    expect(screen.getByText('Unassigned Zero Filled')).toBeInTheDocument();
  });

  it('auto-opens schedule notification dialog after saving', async () => {
    const user = userEvent.setup();

    render(
      <ScheduleGrid
        {...baseProps}
        games={[
          {
            id: 'game-1',
            name: 'Game One',
            status: 'active',
            sessionsPerMonth: 2,
            scheduledDays: [1, 7],
            members: [],
          },
        ]}
        unassignedMembers={[]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /save schedule/i }));

    await screen.findByText('Send schedule notifications');
    expect(mockGetScheduleNotificationDialogData).toHaveBeenCalledWith('guild-1', 2026, 5, [
      'game-1',
    ]);
    expect(screen.getByLabelText('Send schedule notification for Game One')).toBeChecked();
    expect(screen.getByLabelText('Send schedule notification for Game Two')).toBeDisabled();
  });

  it('supports manual open and send of schedule notifications', async () => {
    const user = userEvent.setup();

    render(
      <ScheduleGrid
        {...baseProps}
        games={[
          {
            id: 'game-1',
            name: 'Game One',
            status: 'active',
            sessionsPerMonth: 2,
            scheduledDays: [1, 7],
            members: [],
          },
        ]}
        unassignedMembers={[]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /send notifications/i }));

    await screen.findByText('Send schedule notifications');
    expect(mockGetScheduleNotificationDialogData).toHaveBeenCalledWith(
      'guild-1',
      2026,
      5,
      undefined,
    );

    await user.click(screen.getByRole('button', { name: /^send notifications$/i }));

    await waitFor(() => {
      expect(mockSendScheduleNotifications).toHaveBeenCalledWith(
        'guild-1',
        2026,
        5,
        [
          { gameId: 'game-1', send: true },
          { gameId: 'game-2', send: false },
        ],
        undefined,
      );
    });
  });
});
