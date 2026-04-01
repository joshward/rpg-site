'use client';

import { twMerge } from 'tailwind-merge';
import { useState, useMemo, Fragment } from 'react';
import { getDaysInMonth, YearMonth } from '@/lib/availability';
import { STATUS_MAP, UNSET_OPTION } from '../../availability/_components/availability-status';
import { NO_LIMIT } from '@/lib/preferences';
import {
  EyeOpenIcon,
  EyeNoneIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  CheckIcon,
} from '@radix-ui/react-icons';
import { saveMonthSchedule } from '@/actions/games';
import { useRouter } from 'next/navigation';
import Button from '@/components/Button';

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
  sessionsPerMonth: number;
  scheduledDays: number[];
  members: Member[];
}

interface ScheduleGridProps {
  guildId: string;
  target: YearMonth;
  now: YearMonth;
  games: Game[];
  unassignedMembers: Member[];
}

const DAY_NAMES = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'] as const;

export default function ScheduleGrid({
  guildId,
  target,
  now,
  games,
  unassignedMembers,
}: ScheduleGridProps) {
  const [showUnsetOptional, setShowUnsetOptional] = useState(true);
  const [gameDates, setGameDates] = useState<Record<string, number[]>>(() => {
    return Object.fromEntries(games.map((g) => [g.id, g.scheduledDays]));
  });
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const daysInMonth = useMemo(() => getDaysInMonth(target.year, target.month), [target]);
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  const allScheduledDays = useMemo(() => {
    const set = new Set<number>();
    Object.values(gameDates).forEach((days) => days.forEach((d) => set.add(d)));
    return set;
  }, [gameDates]);

  // Editing window check: current month or next month
  const isEditable = useMemo(() => {
    const currentYear = now.year;
    const currentMonth = now.month;

    const targetDate = new Date(target.year, target.month - 1);
    const currentDate = new Date(currentYear, currentMonth - 1);
    const nextMonthDate = new Date(currentYear, currentMonth);

    return (
      targetDate.getTime() === currentDate.getTime() ||
      targetDate.getTime() === nextMonthDate.getTime()
    );
  }, [target]);

  const toggleDay = (gameId: string, day: number) => {
    if (!isEditable) return;

    setGameDates((prev) => {
      const currentDays = prev[gameId] || [];
      const isSelected = currentDays.includes(day);

      const newState = { ...prev };

      if (isSelected) {
        newState[gameId] = currentDays.filter((d) => d !== day);
      } else {
        // Conflict detection: remove this day from any other game
        for (const [otherGameId, otherDays] of Object.entries(newState)) {
          if (otherGameId !== gameId && otherDays.includes(day)) {
            newState[otherGameId] = otherDays.filter((d) => d !== day);
          }
        }
        newState[gameId] = [...currentDays, day].sort((a, b) => a - b);
      }

      return newState;
    });
  };

  const clearGame = (gameId: string) => {
    if (!isEditable) return;
    setGameDates((prev) => ({ ...prev, [gameId]: [] }));
  };

  const clearAll = () => {
    if (!isEditable) return;
    setGameDates((prev) => {
      const newState = { ...prev };
      for (const gameId in newState) {
        newState[gameId] = [];
      }
      return newState;
    });
  };

  const handleSave = async () => {
    if (!isEditable || saving) return;
    setSaving(true);
    const result = await saveMonthSchedule(guildId, target.year, target.month, gameDates);
    if (result.type === 'failure') {
      alert(result.error);
    } else {
      router.refresh();
    }
    setSaving(false);
  };

  const gameWarnings = useMemo(() => {
    const warnings = new Map<string, string>();
    for (const game of games) {
      const count = gameDates[game.id]?.length || 0;
      if (count > game.sessionsPerMonth) {
        warnings.set(
          game.id,
          `${count} sessions scheduled vs ${game.sessionsPerMonth} configured.`,
        );
      }
    }
    return warnings;
  }, [games, gameDates]);

  const memberWarnings = useMemo(() => {
    const warnings = new Map<string, string>();
    const memberScheduleCount = new Map<string, number>();
    const membersMap = new Map<string, Member>();

    for (const game of games) {
      const scheduledDays = gameDates[game.id] || [];
      for (const member of game.members) {
        membersMap.set(member.discordUserId, member);
        if (member.isRequired) {
          const current = memberScheduleCount.get(member.discordUserId) || 0;
          memberScheduleCount.set(member.discordUserId, current + scheduledDays.length);
        }
      }
    }

    for (const [userId, count] of memberScheduleCount.entries()) {
      const member = membersMap.get(userId);
      if (member && member.sessionsPerMonth !== null && member.sessionsPerMonth !== NO_LIMIT) {
        if (count > member.sessionsPerMonth) {
          warnings.set(
            userId,
            `${count} sessions scheduled vs ${member.sessionsPerMonth} preferred.`,
          );
        }
      }
    }
    return warnings;
  }, [games, gameDates]);

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

    const warning = memberWarnings.get(member.discordUserId);

    return (
      <tr
        key={`${keyPrefix}-${member.discordUserId}`}
        className="border-b border-sage-4 hover:bg-sage-3/50 transition-colors"
      >
        <td className="sticky left-0 z-20 bg-sage-2 border-r border-sage-4 p-2 w-[200px] min-w-[200px] overflow-hidden">
          <div className="flex flex-col min-w-0 relative">
            <div className="flex items-center gap-1 min-w-0">
              <span
                className="font-medium text-xs truncate text-sage-12"
                title={member.displayName}
              >
                {member.displayName}
              </span>
              {warning && (
                <div title={warning} className="shrink-0">
                  <ExclamationTriangleIcon className="w-3 h-3 text-amber-11" />
                </div>
              )}
            </div>
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

          const isSelected = !isUnassigned && gameDates[keyPrefix]?.includes(day);
          const isConflict = !isUnassigned && !isSelected && allScheduledDays.has(day);

          return (
            <td
              key={day}
              className={twMerge(
                'p-0 border-r border-sage-3 text-center min-w-[32px] h-10 transition-colors relative',
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
              {isSelected && (
                <div className="absolute inset-0 bg-violet-9/15 pointer-events-none" />
              )}
              {isConflict && <div className="absolute inset-0 bg-black/10 pointer-events-none" />}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center bg-sage-2 p-3 rounded-xl border border-sage-4">
        <div className="flex items-center gap-2 text-xs font-medium text-sage-11">
          {!isEditable && (
            <span className="flex items-center gap-1 text-amber-11 bg-amber-2 px-2 py-1 rounded border border-amber-4">
              <ExclamationTriangleIcon className="w-3 h-3" />
              Read-only view
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isEditable && (
            <>
              <Button
                variant="danger"
                size="sm"
                onClick={clearAll}
                className="bg-transparent border-ruby-6 hover:bg-ruby-3 text-ruby-11 gap-1"
              >
                <TrashIcon />
                Clear All
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                loading={saving}
                variant="primary"
                className="gap-1 shadow-md"
              >
                <CheckIcon />
                Save Schedule
              </Button>
              <div className="w-px h-6 bg-sage-4 mx-1" />
            </>
          )}
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
            {filteredGames.map((game) => {
              const warning = gameWarnings.get(game.id);
              return (
                <Fragment key={game.id}>
                  <tr className="bg-sage-3 border-b border-sage-4">
                    <td className="sticky left-0 z-20 bg-sage-3 p-2 font-bold text-xs uppercase tracking-wider text-sage-12 border-b border-sage-4 w-[200px] min-w-[200px]">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate" title={game.name}>
                            {game.name}
                          </span>
                          {warning && (
                            <div title={warning} className="shrink-0">
                              <ExclamationTriangleIcon className="w-3.5 h-3.5 text-ruby-11" />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={twMerge(
                              'px-1.5 py-0.5 text-[9px] font-bold rounded-full border uppercase tracking-tight shrink-0',
                              game.status === 'active'
                                ? 'bg-jade-4 text-jade-11 border-jade-6'
                                : 'bg-amber-4 text-amber-11 border-amber-6',
                            )}
                          >
                            {game.status}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold text-sage-11 tabular-nums">
                              {gameDates[game.id]?.length || 0} / {game.sessionsPerMonth}
                            </span>
                            {isEditable && (
                              <button
                                type="button"
                                onClick={() => clearGame(game.id)}
                                className="p-1 hover:bg-ruby-3 text-ruby-11 rounded transition-colors"
                                title="Clear game schedule"
                              >
                                <TrashIcon className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    {days.map((day) => {
                      const isSelected = gameDates[game.id]?.includes(day);
                      const otherGameId = Object.keys(gameDates).find(
                        (id) => id !== game.id && gameDates[id]?.includes(day),
                      );
                      const otherGameName = otherGameId
                        ? games.find((g) => g.id === otherGameId)?.name
                        : null;

                      return (
                        <td
                          key={day}
                          className={twMerge(
                            'p-0 border-r border-sage-4 bg-sage-3/30 min-w-[32px] h-10 transition-colors',
                            isEditable && 'cursor-pointer hover:bg-sage-4/50',
                            isSelected && 'bg-violet-9/20',
                            otherGameId && 'bg-black/10',
                          )}
                          onClick={() => toggleDay(game.id, day)}
                        >
                          <div className="w-full h-full flex items-center justify-center">
                            {isSelected ? (
                              <div className="w-6 h-6 rounded-md bg-violet-9 text-white flex items-center justify-center shadow-sm">
                                <CheckIcon className="w-4 h-4 font-bold" />
                              </div>
                            ) : otherGameName ? (
                              <div
                                className="w-5 h-5 rounded-full border-2 border-sage-8 bg-sage-4/50 flex items-center justify-center"
                                title={`Already scheduled for: ${otherGameName}`}
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-sage-11" />
                              </div>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  {game.members.map((member) => renderMemberRow(member, game.id))}
                </Fragment>
              );
            })}

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
        <div className="w-px h-4 bg-sage-4 mx-2" />
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-md bg-violet-9 text-white flex items-center justify-center shadow-sm">
            <CheckIcon className="w-2.5 h-2.5 font-bold" />
          </div>
          <span className="text-sage-12">Scheduled Game</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full border-2 border-sage-8 bg-sage-4/50 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-sage-11" />
          </div>
          <span className="text-sage-12">Conflict (Another Game)</span>
        </div>
        <div className="w-px h-4 bg-sage-4 mx-2" />
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-sm bg-violet-9/15 border border-violet-9/30" />
          <span className="text-sage-12">Game Column Highlight</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-sm bg-black/10 border border-black/20" />
          <span className="text-sage-12">Other Game Day Darken</span>
        </div>
      </div>
    </div>
  );
}
