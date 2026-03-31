'use client';

import { twMerge } from 'tailwind-merge';
import { useState, useMemo, Fragment } from 'react';
import { getDaysInMonth, YearMonth } from '@/lib/availability';
import { STATUS_MAP, UNSET_OPTION } from '../../availability/_components/availability-status';
import { NO_LIMIT } from '@/lib/preferences';
import { EyeOpenIcon, EyeNoneIcon } from '@radix-ui/react-icons';

interface Member {
  discordUserId: string;
  displayName: string;
  avatar: string | null | undefined;
  sessionsPerMonth: number | null;
  availability: Record<number, string>;
  isRequired?: boolean;
}

interface Game {
  id: string;
  name: string;
  status: string;
  members: Member[];
}

interface ScheduleGridProps {
  target: YearMonth;
  games: Game[];
  unassignedMembers: Member[];
}

const DAY_NAMES = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'] as const;

export default function ScheduleGrid({ target, games, unassignedMembers }: ScheduleGridProps) {
  const [showUnsetOptional, setShowUnsetOptional] = useState(true);
  const daysInMonth = useMemo(() => getDaysInMonth(target.year, target.month), [target]);
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  const filteredGames = useMemo(() => {
    if (showUnsetOptional) return games;
    return games.map((game) => ({
      ...game,
      members: game.members.filter((member) => {
        if (member.isRequired) return true;
        return Object.keys(member.availability).length > 0;
      }),
    }));
  }, [games, showUnsetOptional]);

  const getDayInfo = (day: number) => {
    const date = new Date(Date.UTC(target.year, target.month - 1, day));
    const dayOfWeek = date.getUTCDay();
    return {
      dayOfWeek,
      name: DAY_NAMES[dayOfWeek],
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    };
  };

  const renderMemberRow = (member: Member, keyPrefix: string, isUnassigned = false) => {
    const sessionsPref =
      member.sessionsPerMonth === null
        ? '?'
        : member.sessionsPerMonth === NO_LIMIT
          ? '∞'
          : member.sessionsPerMonth;

    return (
      <tr
        key={`${keyPrefix}-${member.discordUserId}`}
        className="border-b border-sage-4 hover:bg-sage-3/50 transition-colors"
      >
        <td className="sticky left-0 z-20 bg-sage-2 border-r border-sage-4 p-2 w-[200px] min-w-[200px] overflow-hidden">
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-xs truncate text-sage-12" title={member.displayName}>
              {member.displayName}
            </span>
            <span className="text-[10px] text-sage-11 flex gap-1 items-center min-w-0">
              {!isUnassigned && (
                <span
                  className={twMerge(
                    'truncate shrink',
                    member.isRequired ? 'text-amber-11 font-bold' : 'text-sage-10 font-medium',
                  )}
                >
                  {member.isRequired ? 'Core' : 'Opt'}
                </span>
              )}
              <span className="shrink-0">Pref: {sessionsPref}</span>
            </span>
          </div>
        </td>
        {days.map((day) => {
          const { isWeekend } = getDayInfo(day);
          const status = member.availability[day];
          const option = status ? STATUS_MAP[status as keyof typeof STATUS_MAP] : UNSET_OPTION;

          return (
            <td
              key={day}
              className={twMerge(
                'p-0 border-r border-sage-3 text-center min-w-[32px] h-10',
                isWeekend && 'bg-sage-3/30',
              )}
            >
              <div
                className={twMerge(
                  'w-full h-full flex items-center justify-center',
                  option.activeClass,
                )}
                title={`Day ${day}: ${option.label}`}
              >
                <option.icon className="w-3.5 h-3.5" />
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowUnsetOptional(!showUnsetOptional)}
          className={twMerge(
            'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border shadow-sm cursor-pointer',
            !showUnsetOptional
              ? 'bg-violet-3 text-violet-11 border-violet-6 hover:bg-violet-4 hover:border-violet-7'
              : 'bg-sage-3 text-sage-11 border-sage-6 hover:bg-sage-4 hover:border-sage-7',
          )}
        >
          {showUnsetOptional ? <EyeOpenIcon /> : <EyeNoneIcon />}
          {showUnsetOptional ? 'Hide Unset Optional' : 'Show Unset Optional'}
        </button>
      </div>

      <div className="overflow-x-auto border border-sage-4 rounded-lg shadow-md max-h-[70vh]">
        <table className="min-w-full border-collapse bg-sage-1">
          <thead>
            <tr className="sticky top-0 z-30 bg-sage-4 border-b border-sage-5 shadow-[0_1px_0_rgba(0,0,0,0.1)]">
              <th className="sticky left-0 top-0 z-40 bg-sage-4 border-r border-sage-5 p-2 text-left w-[200px] min-w-[200px] font-bold text-sm text-sage-12"></th>
              {days.map((day) => {
                const { name, isWeekend } = getDayInfo(day);
                return (
                  <th
                    key={day}
                    className={twMerge(
                      'p-1 border-r border-sage-5 min-w-[32px] text-center',
                      isWeekend && 'bg-sage-5/30',
                    )}
                  >
                    <div className="text-[10px] text-sage-12 uppercase font-bold">{name}</div>
                    <div className="text-sm font-bold text-sage-12">{day}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredGames.map((game) => (
              <Fragment key={game.id}>
                <tr className="bg-sage-3 border-b border-sage-4">
                  <td className="sticky left-0 z-20 bg-sage-3 p-2 font-bold text-xs uppercase tracking-wider text-sage-12 border-b border-sage-4 w-[200px] min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{game.name}</span>
                      <span
                        className={twMerge(
                          'px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-tight shrink-0',
                          game.status === 'active'
                            ? 'bg-jade-4 text-jade-11 border-jade-6'
                            : 'bg-amber-4 text-amber-11 border-amber-6',
                        )}
                      >
                        {game.status}
                      </span>
                    </div>
                  </td>
                  {days.map((day) => (
                    <td
                      key={day}
                      className="p-0 border-r border-sage-4 bg-sage-3/30 min-w-[32px] h-8"
                    ></td>
                  ))}
                </tr>
                {game.members.map((member) => renderMemberRow(member, game.id))}
              </Fragment>
            ))}

            {unassignedMembers.length > 0 && (
              <Fragment>
                <tr className="bg-sage-3 border-b border-sage-4">
                  <td className="sticky left-0 z-20 bg-sage-3 p-2 font-bold text-xs uppercase tracking-wider text-sage-12 border-b border-sage-4 w-[200px] min-w-[200px]">
                    Unassigned Players
                  </td>
                  {days.map((day) => (
                    <td
                      key={day}
                      className="p-0 border-r border-sage-4 bg-sage-3/30 min-w-[32px] h-8"
                    ></td>
                  ))}
                </tr>
                {unassignedMembers.map((member) => renderMemberRow(member, 'unassigned', true))}
              </Fragment>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 text-xs p-2 bg-sage-2 rounded-md border border-sage-4">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-sage-11 uppercase">Legend:</span>
        </div>
        {[...Object.values(STATUS_MAP), UNSET_OPTION].map((opt) => (
          <div key={opt.label} className="flex items-center gap-1.5">
            <div
              className={twMerge(
                'w-4 h-4 rounded-sm flex items-center justify-center',
                opt.activeClass,
              )}
            >
              <opt.icon className="w-2.5 h-2.5" />
            </div>
            <span className="text-sage-12">{opt.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
