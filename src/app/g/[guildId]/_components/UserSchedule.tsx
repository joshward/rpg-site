'use client';

import * as React from 'react';
import type { AvailabilityStatus } from '@/actions/availability';
import { AvailabilityIndicator, formatScheduledDate } from './UserGameList';

export interface UserScheduleGame {
  id: string;
  name: string;
  scheduledDates?: {
    year: number;
    month: number;
    day: number;
    availability: AvailabilityStatus | null;
  }[];
}

export interface UserScheduleProps {
  games: UserScheduleGame[];
}

export default function UserSchedule({ games }: UserScheduleProps) {
  const sessions = React.useMemo(() => {
    const list: {
      gameId: string;
      gameName: string;
      year: number;
      month: number;
      day: number;
      availability: AvailabilityStatus | null;
    }[] = [];

    for (const game of games) {
      if (!game.scheduledDates) continue;
      for (const date of game.scheduledDates) {
        if (date.availability === 'unavailable') continue;
        list.push({
          gameId: game.id,
          gameName: game.name,
          year: date.year,
          month: date.month,
          day: date.day,
          availability: date.availability,
        });
      }
    }

    return list.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.month !== b.month) return a.month - b.month;
      if (a.day !== b.day) return a.day - b.day;
      return a.gameName.localeCompare(b.gameName);
    });
  }, [games]);

  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xl font-bold px-1">Your Schedule</h2>
      <div className="flex flex-wrap gap-2">
        {sessions.map((session) => (
          <div
            key={`${session.gameId}-${session.year}-${session.month}-${session.day}`}
            className="bg-violet-3 text-violet-11 border border-violet-6 pl-1 pr-3 py-1 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm"
          >
            <AvailabilityIndicator status={session.availability} />
            <span>
              {formatScheduledDate(session)} - {session.gameName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
