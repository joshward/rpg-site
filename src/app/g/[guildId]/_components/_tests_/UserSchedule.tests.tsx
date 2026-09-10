import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import UserSchedule, { UserScheduleGame } from '../UserSchedule';

describe('UserSchedule', () => {
  it('renders nothing when games array is empty', () => {
    const { container } = render(<UserSchedule games={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when games have no scheduled dates', () => {
    const games: UserScheduleGame[] = [
      {
        id: 'game-1',
        name: 'Game One',
        scheduledDates: [],
      },
      {
        id: 'game-2',
        name: 'Game Two',
      },
    ];

    const { container } = render(<UserSchedule games={games} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when all scheduled dates are marked as unavailable', () => {
    const games: UserScheduleGame[] = [
      {
        id: 'game-1',
        name: 'Game One',
        scheduledDates: [
          { year: 2026, month: 5, day: 10, availability: 'unavailable' },
          { year: 2026, month: 5, day: 15, availability: 'unavailable' },
        ],
      },
    ];

    const { container } = render(<UserSchedule games={games} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders scheduled sessions combining games and sorted chronologically', () => {
    const games: UserScheduleGame[] = [
      {
        id: 'game-b',
        name: 'Beta Campaign',
        scheduledDates: [
          { year: 2026, month: 6, day: 1, availability: 'available' },
          { year: 2026, month: 5, day: 20, availability: 'late' },
        ],
      },
      {
        id: 'game-a',
        name: 'Alpha Campaign',
        scheduledDates: [
          { year: 2026, month: 5, day: 10, availability: 'if_needed' },
          { year: 2026, month: 5, day: 25, availability: null },
        ],
      },
    ];

    render(<UserSchedule games={games} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Your Schedule' })).toBeInTheDocument();

    const textElements = screen.getAllByText(/- (Alpha Campaign|Beta Campaign)/);
    expect(textElements).toHaveLength(4);

    // Verify chronological order
    expect(textElements[0]).toHaveTextContent('Sun, May 10 - Alpha Campaign');
    expect(textElements[1]).toHaveTextContent('Wed, May 20 - Beta Campaign');
    expect(textElements[2]).toHaveTextContent('Mon, May 25 - Alpha Campaign');
    expect(textElements[3]).toHaveTextContent('Mon, Jun 1 - Beta Campaign');
  });

  it('excludes sessions marked unavailable while keeping others', () => {
    const games: UserScheduleGame[] = [
      {
        id: 'game-1',
        name: 'Curse of Strahd',
        scheduledDates: [
          { year: 2026, month: 5, day: 10, availability: 'unavailable' },
          { year: 2026, month: 5, day: 12, availability: 'available' },
        ],
      },
    ];

    render(<UserSchedule games={games} />);

    expect(screen.queryByText(/Sun, May 10/)).not.toBeInTheDocument();
    expect(screen.getByText(/Tue, May 12 - Curse of Strahd/)).toBeInTheDocument();
  });

  it('sorts same-day sessions alphabetically by game name', () => {
    const games: UserScheduleGame[] = [
      {
        id: 'game-z',
        name: 'Zeta Game',
        scheduledDates: [{ year: 2026, month: 5, day: 15, availability: 'available' }],
      },
      {
        id: 'game-a',
        name: 'Alpha Game',
        scheduledDates: [{ year: 2026, month: 5, day: 15, availability: 'available' }],
      },
    ];

    render(<UserSchedule games={games} />);

    const textElements = screen.getAllByText(/- (Alpha Game|Zeta Game)/);
    expect(textElements[0]).toHaveTextContent('Fri, May 15 - Alpha Game');
    expect(textElements[1]).toHaveTextContent('Fri, May 15 - Zeta Game');
  });
});
