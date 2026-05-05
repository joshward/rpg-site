import { describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {},
}));

vi.mock('@/actions/auth-helpers', () => ({
  ensureAdmin: vi.fn(),
  ensureAccess: vi.fn(),
}));

vi.mock('@/lib/discord/api', () => ({
  getGuildMembers: vi.fn(),
}));

import { getChangedGameIdsForMonthSchedule } from '../games';

describe('getChangedGameIdsForMonthSchedule', () => {
  it('returns no changed games when effective day sets are unchanged', () => {
    const changedGameIds = getChangedGameIdsForMonthSchedule(
      ['game-1', 'game-2'],
      [
        { gameId: 'game-1', day: 5 },
        { gameId: 'game-1', day: 12 },
        { gameId: 'game-2', day: 18 },
      ],
      {
        'game-1': [12, 5],
        'game-2': [18],
      },
    );

    expect(changedGameIds).toEqual([]);
  });

  it('marks games as changed when days are added, removed, or moved', () => {
    const changedGameIds = getChangedGameIdsForMonthSchedule(
      ['game-1', 'game-2', 'game-3'],
      [
        { gameId: 'game-1', day: 7 },
        { gameId: 'game-2', day: 15 },
      ],
      {
        'game-1': [9],
        'game-2': [],
        'game-3': [21],
      },
    );

    expect(changedGameIds).toEqual(['game-1', 'game-2', 'game-3']);
  });

  it('treats omitted game entries as cleared schedules', () => {
    const changedGameIds = getChangedGameIdsForMonthSchedule(
      ['game-1', 'game-2'],
      [
        { gameId: 'game-1', day: 11 },
        { gameId: 'game-2', day: 22 },
      ],
      {
        'game-1': [11],
      },
    );

    expect(changedGameIds).toEqual(['game-2']);
  });
});
