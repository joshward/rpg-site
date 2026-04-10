'use client';

import * as React from 'react';
import Paper from '@/components/Paper';
import Link from '@/components/Link';
import MarkdownPreview from '@/components/MarkdownPreview';
import { GameStatus } from '@/db/schema/games';
import { twMerge } from 'tailwind-merge';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { STATUS_MAP, UNSET_OPTION } from '../availability/_components/availability-status';
import { AvailabilityStatus } from '@/actions/availability';

interface Member {
  discordUserId: string;
  isRequired: boolean;
  displayName: string;
  avatar: string | null;
}

interface Game {
  id: string;
  name: string;
  description: string | null;
  status: GameStatus;
  sessionsPerMonth: number;
  isRequired: boolean;
  scheduledDates?: {
    year: number;
    month: number;
    day: number;
    availability: AvailabilityStatus | null;
  }[];
  members: Member[];
}

interface UserGameListProps {
  games: Game[];
  adminContact?: {
    adminText: string;
    channelLink: string | null;
    channelName: string | undefined;
    adminContactInfo?: string | null;
  };
  defaultSchedulingDetails?: string | null;
}

const statusColors: Record<GameStatus, string> = {
  draft: 'bg-sage-4 text-sage-11 border-sage-6',
  active: 'bg-jade-4 text-jade-11 border-jade-6',
  paused: 'bg-amber-4 text-amber-11 border-amber-6',
  archived: 'bg-slate-4 text-slate-11 border-slate-6',
};

function formatScheduledDate(date: { year: number; month: number; day: number }) {
  return new Date(date.year, date.month - 1, date.day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function UserGameList({
  games,
  adminContact,
  defaultSchedulingDetails,
}: UserGameListProps) {
  const activeGames = games
    .filter((g) => g.status === 'active')
    .sort((a, b) => a.name.localeCompare(b.name));
  const pausedGames = games
    .filter((g) => g.status === 'paused')
    .sort((a, b) => a.name.localeCompare(b.name));

  const hasAnyGames = activeGames.length > 0 || pausedGames.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold px-1">Your Games</h2>

      {!hasAnyGames && adminContact && (
        <Paper className="p-4 text-sage-11">
          <p>
            You&apos;re not currently part of any ongoing games. Reach out to{' '}
            {adminContact.adminContactInfo || 'your guild admin'}
            {adminContact.channelLink && (
              <>
                {' '}
                or in{' '}
                <Link href={adminContact.channelLink}>
                  #{adminContact.channelName || 'support'}
                </Link>
              </>
            )}{' '}
            to get started.
          </p>
        </Paper>
      )}

      {hasAnyGames && (
        <div className="grid grid-cols-1 gap-4">
          {activeGames.map((game) => (
            <UserGameItem
              key={game.id}
              game={game}
              defaultSchedulingDetails={defaultSchedulingDetails}
            />
          ))}

          {activeGames.length > 0 && pausedGames.length > 0 && (
            <hr className="border-sage-4 my-2" />
          )}

          {pausedGames.map((game) => (
            <UserGameItem
              key={game.id}
              game={game}
              defaultSchedulingDetails={defaultSchedulingDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AvailabilityIndicator({
  status,
  size = 'md',
}: {
  status: AvailabilityStatus | null;
  size?: 'sm' | 'md';
}) {
  const option = status ? STATUS_MAP[status] : UNSET_OPTION;
  const Icon = option.icon;

  if (size === 'sm') {
    return (
      <div
        className={twMerge(
          'w-5 h-5 rounded-full flex items-center justify-center border border-black/10 shadow-sm shrink-0',
          option.activeClass,
        )}
        title={option.label}
      >
        <Icon className="w-3 h-3" />
      </div>
    );
  }

  return (
    <div
      className={twMerge(
        'w-6 h-6 rounded-lg flex items-center justify-center border border-black/10 shadow-sm shrink-0',
        option.activeClass,
      )}
      title={option.label}
    >
      <Icon className="w-4 h-4" />
    </div>
  );
}

function UserGameItem({
  game,
  defaultSchedulingDetails,
}: {
  game: Game;
  defaultSchedulingDetails?: string | null;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const nextSession = game.scheduledDates?.[0] ?? null;
  const userNextSession = React.useMemo(() => {
    if (!game.scheduledDates || game.scheduledDates.length <= 1) return null;

    // True next is index 0. If user is unavailable/unset for index 0, find the next one they ARE available for.
    const trueNextStatus = game.scheduledDates[0].availability;
    if (trueNextStatus !== 'unavailable' && trueNextStatus !== null) return null;

    return (
      game.scheduledDates
        .slice(1)
        .find((s) => s.availability !== 'unavailable' && s.availability !== null) ?? null
    );
  }, [game.scheduledDates]);

  return (
    <Paper className="p-0 overflow-hidden hover:border-plum-8 transition-colors">
      <div
        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-sage-2 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold leading-tight">{game.name}</h3>
            <span
              className={twMerge(
                'px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border leading-none',
                statusColors[game.status],
              )}
            >
              {game.status}
            </span>
            <span
              className={twMerge(
                'px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border leading-none',
                game.isRequired
                  ? 'bg-violet-4 text-violet-11 border-violet-6'
                  : 'bg-sage-4 text-sage-11 border-sage-6',
              )}
            >
              {game.isRequired ? 'Core Participant' : 'Optional Participant'}
            </span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-6">
            <div className="text-sm text-sage-11 font-medium">
              {game.sessionsPerMonth} sessions per month (approximate)
              {defaultSchedulingDetails && (
                <>
                  <span className="mx-2 text-sage-6">|</span>
                  {defaultSchedulingDetails}
                </>
              )}
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
              {nextSession && (
                <div className="text-sm text-violet-11 font-bold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-9 animate-pulse shrink-0" />
                  <div className="flex items-center gap-1.5">
                    <span>Next session:</span>
                    <div className="flex items-center gap-1 bg-violet-3 px-2 py-0.5 rounded-md border border-violet-5">
                      <AvailabilityIndicator status={nextSession.availability} size="sm" />
                      {formatScheduledDate(nextSession)}
                    </div>
                  </div>
                </div>
              )}
              {userNextSession && (
                <div className="text-sm text-jade-11 font-bold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-jade-9 shrink-0" />
                  <div className="flex items-center gap-1.5">
                    <span>Your next session:</span>
                    <div className="flex items-center gap-1 bg-jade-3 px-2 py-0.5 rounded-md border border-jade-5">
                      <AvailabilityIndicator status={userNextSession.availability} size="sm" />
                      {formatScheduledDate(userNextSession)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 text-sage-11">
          <span className="text-sm font-medium">
            {isExpanded ? 'Hide Details' : 'Show Details'}
          </span>
          {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-6 pt-2 border-t border-sage-4 flex flex-col gap-6 bg-sage-1/50">
          {game.scheduledDates && game.scheduledDates.length > 0 && (
            <div className="flex flex-col gap-2 pt-2">
              <h4 className="text-xs font-bold text-sage-11 uppercase tracking-wider">
                Scheduled Sessions
              </h4>
              <div className="flex flex-wrap gap-2">
                {game.scheduledDates.map((date) => (
                  <div
                    key={`${date.year}-${date.month}-${date.day}`}
                    className="bg-violet-3 text-violet-11 border border-violet-6 pl-1 pr-3 py-1 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm"
                  >
                    <AvailabilityIndicator status={date.availability} />
                    {formatScheduledDate(date)}
                  </div>
                ))}
              </div>
            </div>
          )}
          {game.description && (
            <div className="flex flex-col gap-2 pt-2">
              <h4 className="text-xs font-bold text-sage-11 uppercase tracking-wider">
                Description
              </h4>
              <MarkdownPreview content={game.description} />
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold text-sage-11 uppercase tracking-wider">Players</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {game.members.map((member) => (
                <div
                  key={member.discordUserId}
                  className="flex items-center gap-3 bg-sage-3 p-2 rounded-lg border border-sage-4"
                >
                  <div className="w-8 h-8 rounded-full bg-sage-5 shrink-0 overflow-hidden border border-sage-6">
                    {member.avatar ? (
                      <img
                        src={`https://cdn.discordapp.com/avatars/${member.discordUserId}/${member.avatar}.png`}
                        alt={member.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-sage-11">
                        {member.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{member.displayName}</span>
                    <span className="text-[10px] text-sage-11 uppercase font-bold tracking-tight">
                      {member.isRequired ? 'Core Participant' : 'Optional Participant'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Paper>
  );
}
