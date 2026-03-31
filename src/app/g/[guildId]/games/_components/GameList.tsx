'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Paper from '@/components/Paper';
import Link from '@/components/Link';
import { GameStatus } from '@/db/schema/games';
import { twMerge } from 'tailwind-merge';
import { PlusIcon, EyeOpenIcon, EyeNoneIcon } from '@radix-ui/react-icons';

interface Game {
  id: string;
  name: string;
  status: GameStatus;
  sessionsPerMonth: number;
  memberCount: number;
}

interface GameListProps {
  initialGames: Game[];
}

const statusColors: Record<GameStatus, string> = {
  draft: 'bg-sage-4 text-sage-11 border-sage-6',
  active: 'bg-jade-4 text-jade-11 border-jade-6',
  paused: 'bg-amber-4 text-amber-11 border-amber-6',
  archived: 'bg-slate-4 text-slate-11 border-slate-6',
};

export default function GameList({ initialGames }: GameListProps) {
  const { guildId } = useParams<{ guildId: string }>();
  const [showArchived, setShowArchived] = React.useState(false);

  const filteredGames = showArchived
    ? initialGames
    : initialGames.filter((game) => game.status !== 'archived');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Games</h1>
        <div className="flex items-center gap-4">
          {initialGames.length > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className={twMerge(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors border shadow-sm cursor-pointer',
                showArchived
                  ? 'bg-violet-3 text-violet-11 border-violet-6 hover:bg-violet-4 hover:border-violet-7'
                  : 'bg-sage-3 text-sage-11 border-sage-6 hover:bg-sage-4 hover:border-sage-7',
              )}
            >
              {showArchived ? <EyeOpenIcon /> : <EyeNoneIcon />}
              {showArchived ? 'Hide Archived' : 'Show Archived'}
            </button>
          )}
          <Link
            href={`/g/${guildId}/games/new`}
            className="flex items-center gap-2 bg-violet-9 text-white px-4 py-2 rounded-xl hover:bg-violet-10 transition-colors shadow-sm font-medium"
          >
            <PlusIcon />
            New Game
          </Link>
        </div>
      </div>

      {filteredGames.length === 0 ? (
        <Paper className="p-12 items-center justify-center text-center">
          <p className="text-sage-11 italic">
            {initialGames.length === 0
              ? 'No games created yet. Click "New Game" to get started.'
              : 'No games match your filters.'}
          </p>
        </Paper>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGames.map((game) => (
            <Paper
              key={game.id}
              className="p-0 overflow-hidden hover:border-plum-8 transition-colors"
            >
              <Link href={`/g/${guildId}/games/${game.id}`} className="flex flex-col h-full">
                <div className="p-6 flex flex-col gap-4 flex-grow">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-xl font-bold line-clamp-2 leading-tight">{game.name}</h2>
                    <span
                      className={twMerge(
                        'px-2 py-0.5 text-xs font-medium rounded-full border',
                        statusColors[game.status],
                      )}
                    >
                      {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-sm text-sage-11">
                    <div>{game.sessionsPerMonth} sessions / month</div>
                    <div>
                      {game.memberCount} {game.memberCount === 1 ? 'player' : 'players'}
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-sage-3 border-t border-sage-4 text-xs text-center font-medium uppercase tracking-wider text-sage-11 group-hover:text-plum-11 transition-colors">
                  Manage Game
                </div>
              </Link>
            </Paper>
          ))}
        </div>
      )}
    </div>
  );
}
