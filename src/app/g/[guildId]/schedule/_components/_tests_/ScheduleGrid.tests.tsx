import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScheduleGrid from '../ScheduleGrid';

const { mockAddNotification, mockPlausible } = vi.hoisted(() => ({
  mockAddNotification: vi.fn(),
  mockPlausible: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
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
  saveMonthSchedule: vi.fn(),
}));

describe('ScheduleGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
