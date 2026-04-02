'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray, count, or, gt, gte } from 'drizzle-orm';
import { db } from '@/db/db';
import { asResult, ActionError } from '@/actions/action-helpers';
import { ensureAdmin, ensureAccess } from '@/actions/auth-helpers';
import { game, gameMember, gameStatusEnum, GameStatus, scheduledSession } from '@/db/schema/games';
import { availabilitySubmission, availabilityDay } from '@/db/schema/availability';
import { AvailabilityStatus } from '@/actions/availability';
import { memberPreference } from '@/db/schema/member-preferences';
import { getGuildMembers } from '@/lib/discord/api';
import { resolveRoleForGuild } from '@/lib/authn';
import { TimeSpan } from 'timespan-ts';
import { getNow } from '@/lib/availability';

export const getGames = asResult(
  'getGames',
  async (guildId: string) => {
    // Only admins for now
    await ensureAdmin(guildId);

    const result = await db
      .select({
        id: game.id,
        name: game.name,
        description: game.description,
        status: game.status,
        sessionsPerMonth: game.sessionsPerMonth,
        createdAt: game.createdAt,
        updatedAt: game.updatedAt,
        memberCount: count(gameMember.id),
      })
      .from(game)
      .leftJoin(gameMember, eq(game.id, gameMember.gameId))
      .where(eq(game.guildId, guildId))
      .groupBy(game.id)
      .orderBy(game.name);

    return result.map((g) => ({
      ...g,
      memberCount: Number(g.memberCount),
    }));
  },
  'Something went wrong fetching games.',
);

export const getMyGames = asResult(
  'getMyGames',
  async (guildId: string) => {
    const { discordAccount } = await ensureAccess(guildId);
    const discordUserId = discordAccount.userId;

    // 1. Find all games where the user is a member and the status is active or paused
    const userGames = await db
      .select({
        id: game.id,
        name: game.name,
        description: game.description,
        status: game.status,
        sessionsPerMonth: game.sessionsPerMonth,
        isRequired: gameMember.isRequired,
      })
      .from(game)
      .innerJoin(gameMember, eq(game.id, gameMember.gameId))
      .where(
        and(
          eq(game.guildId, guildId),
          eq(gameMember.discordUserId, discordUserId),
          inArray(game.status, ['active', 'paused']),
        ),
      )
      .orderBy(game.name);

    if (userGames.length === 0) {
      return [];
    }

    const gameIds = userGames.map((g) => g.id);

    // 2. Fetch all members for these games
    const allMembers = await db
      .select()
      .from(gameMember)
      .where(inArray(gameMember.gameId, gameIds));

    // 3. Fetch Discord members for display names/avatars
    const discordMembers = await getGuildMembers(
      { guildId },
      { cacheFor: TimeSpan.fromMinutes(5) },
    );
    const discordMembersMap = new Map(discordMembers.map((m) => [m.user.id, m]));

    // 4. Fetch scheduled sessions from today onwards
    const now = getNow();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    const scheduled = await db
      .select()
      .from(scheduledSession)
      .where(
        and(
          eq(scheduledSession.guildId, guildId),
          inArray(scheduledSession.gameId, gameIds),
          or(
            gt(scheduledSession.year, currentYear),
            and(eq(scheduledSession.year, currentYear), gt(scheduledSession.month, currentMonth)),
            and(
              eq(scheduledSession.year, currentYear),
              eq(scheduledSession.month, currentMonth),
              gte(scheduledSession.day, currentDay),
            ),
          ),
        ),
      )
      .orderBy(scheduledSession.year, scheduledSession.month, scheduledSession.day);

    // 4b. Fetch current user's availability for these sessions
    const scheduledMonths = [...new Set(scheduled.map((s) => `${s.year}-${s.month}`))];
    const availabilityMap = new Map<string, AvailabilityStatus>(); // "year-month-day" -> status

    if (scheduledMonths.length > 0) {
      const submissions = await db
        .select({
          id: availabilitySubmission.id,
          year: availabilitySubmission.year,
          month: availabilitySubmission.month,
        })
        .from(availabilitySubmission)
        .where(
          and(
            eq(availabilitySubmission.guildId, guildId),
            eq(availabilitySubmission.discordUserId, discordUserId),
            or(
              ...scheduledMonths.map((m) => {
                const [y, mon] = m.split('-').map(Number);
                return and(
                  eq(availabilitySubmission.year, y),
                  eq(availabilitySubmission.month, mon),
                );
              }),
            ),
          ),
        );

      if (submissions.length > 0) {
        const days = await db
          .select({
            submissionId: availabilityDay.submissionId,
            day: availabilityDay.day,
            status: availabilityDay.status,
          })
          .from(availabilityDay)
          .where(
            inArray(
              availabilityDay.submissionId,
              submissions.map((s) => s.id),
            ),
          );

        for (const day of days) {
          const sub = submissions.find((s) => s.id === day.submissionId);
          if (sub) {
            availabilityMap.set(
              `${sub.year}-${sub.month}-${day.day}`,
              day.status as AvailabilityStatus,
            );
          }
        }
      }
    }

    // 5. Combine them
    return userGames.map((g) => ({
      ...g,
      scheduledDates: scheduled
        .filter((s) => s.gameId === g.id)
        .map((s) => ({
          year: s.year,
          month: s.month,
          day: s.day,
          availability: availabilityMap.get(`${s.year}-${s.month}-${s.day}`) ?? null,
        })),
      members: allMembers
        .filter((m) => m.gameId === g.id)
        .map((m) => {
          const dm = discordMembersMap.get(m.discordUserId);
          return {
            discordUserId: m.discordUserId,
            isRequired: m.isRequired,
            displayName: dm ? dm.nick || dm.user.global_name || dm.user.username : 'Unknown User',
            avatar: dm?.user.avatar ?? null,
          };
        }),
    }));
  },
  'Something went wrong fetching your games.',
);

export const getGame = asResult(
  'getGame',
  async (guildId: string, gameId: string) => {
    await ensureAdmin(guildId);

    const gameData = (
      await db
        .select()
        .from(game)
        .where(and(eq(game.id, gameId), eq(game.guildId, guildId)))
    )[0];

    if (!gameData) {
      throw new ActionError('Game not found.');
    }

    const members = await db.select().from(gameMember).where(eq(gameMember.gameId, gameId));

    return {
      ...gameData,
      members,
    };
  },
  'Something went wrong fetching the game.',
);

export type GameFormData = {
  name: string;
  description: string | null;
  status: GameStatus;
  sessionsPerMonth: number;
  members: {
    discordUserId: string;
    isRequired: boolean;
  }[];
};

export const createGame = asResult(
  'createGame',
  async (guildId: string, data: GameFormData) => {
    await ensureAdmin(guildId);

    // Validate data
    if (!data.name) throw new ActionError('Game name is required.');
    if (!gameStatusEnum.includes(data.status)) throw new ActionError('Invalid status.');
    if (data.sessionsPerMonth < 0) throw new ActionError('Sessions per month must be positive.');

    const result = await db.transaction(async (tx) => {
      const [newGame] = await tx
        .insert(game)
        .values({
          guildId,
          name: data.name,
          description: data.description,
          status: data.status,
          sessionsPerMonth: data.sessionsPerMonth,
        })
        .returning();

      if (data.members.length > 0) {
        await tx.insert(gameMember).values(
          data.members.map((m) => ({
            gameId: newGame.id,
            discordUserId: m.discordUserId,
            isRequired: m.isRequired,
          })),
        );
      }

      return newGame;
    });

    revalidatePath(`/g/${guildId}/games`);
    return result;
  },
  'Something went wrong creating the game.',
);

export const updateGame = asResult(
  'updateGame',
  async (guildId: string, gameId: string, data: GameFormData) => {
    await ensureAdmin(guildId);

    // Validate data
    if (!data.name) throw new ActionError('Game name is required.');
    if (!gameStatusEnum.includes(data.status)) throw new ActionError('Invalid status.');
    if (data.sessionsPerMonth < 0) throw new ActionError('Sessions per month must be positive.');

    const result = await db.transaction(async (tx) => {
      // Ensure game exists and belongs to guild
      const existing = (
        await tx
          .select()
          .from(game)
          .where(and(eq(game.id, gameId), eq(game.guildId, guildId)))
      )[0];

      if (!existing) {
        throw new ActionError('Game not found.');
      }

      const [updatedGame] = await tx
        .update(game)
        .set({
          name: data.name,
          description: data.description,
          status: data.status,
          sessionsPerMonth: data.sessionsPerMonth,
          updatedAt: new Date(),
        })
        .where(eq(game.id, gameId))
        .returning();

      // Update members
      // Simplest way: delete all and re-insert (or diff)
      await tx.delete(gameMember).where(eq(gameMember.gameId, gameId));
      if (data.members.length > 0) {
        await tx.insert(gameMember).values(
          data.members.map((m) => ({
            gameId,
            discordUserId: m.discordUserId,
            isRequired: m.isRequired,
          })),
        );
      }

      return updatedGame;
    });

    revalidatePath(`/g/${guildId}/games`);
    revalidatePath(`/g/${guildId}/games/${gameId}`);

    return result;
  },
  'Something went wrong updating the game.',
);

export const deleteGame = asResult(
  'deleteGame',
  async (guildId: string, gameId: string) => {
    await ensureAdmin(guildId);

    const result = await db
      .delete(game)
      .where(and(eq(game.id, gameId), eq(game.guildId, guildId)))
      .returning();

    if (result.length === 0) {
      throw new ActionError('Game not found.');
    }

    revalidatePath(`/g/${guildId}/games`);
  },
  'Something went wrong deleting the game.',
);

export const getEligibleGameMembers = asResult(
  'getEligibleGameMembers',
  async (guildId: string) => {
    const { guildData } = await ensureAdmin(guildId);
    const allowedRoles = guildData?.allowedRoles ?? [];

    const members = await getGuildMembers({ guildId }, { cacheFor: TimeSpan.fromMinutes(1) });

    const mappedResults = await Promise.all(
      members.map(async (m) => {
        if (m.user.bot) return null;

        const role = await resolveRoleForGuild(m.roles, guildId, allowedRoles);
        if (role === 'none') return null;

        return {
          discordUserId: m.user.id,
          username: m.user.username,
          displayName: m.nick || m.user.global_name || m.user.username,
          avatar: m.user.avatar,
        };
      }),
    );

    const result = mappedResults.filter((m) => m !== null) as NonNullable<
      (typeof mappedResults)[number]
    >[];

    return result.sort((a, b) => a.displayName.localeCompare(b.displayName));
  },
  'Something went wrong fetching eligible members.',
);

export const isMonthScheduled = asResult(
  'isMonthScheduled',
  async (guildId: string, year: number, month: number) => {
    await ensureAccess(guildId);

    const scheduled = await db
      .select()
      .from(scheduledSession)
      .where(
        and(
          eq(scheduledSession.guildId, guildId),
          eq(scheduledSession.year, year),
          eq(scheduledSession.month, month),
        ),
      )
      .limit(1);

    return (scheduled?.length ?? 0) > 0;
  },
  'Something went wrong checking the schedule.',
);

export const getAdminSchedule = asResult(
  'getAdminSchedule',
  async (guildId: string, year: number, month: number) => {
    const { guildData } = await ensureAdmin(guildId);
    const allowedRoles = guildData?.allowedRoles ?? [];

    // 1. Fetch all active and paused games with their members
    const games = await db
      .select()
      .from(game)
      .where(and(eq(game.guildId, guildId), inArray(game.status, ['active', 'paused'])))
      .orderBy(game.status, game.name); // Active before Paused (alphabetical within status)

    const gameIds = games.map((g) => g.id);

    const allGameMembers =
      gameIds.length > 0
        ? await db.select().from(gameMember).where(inArray(gameMember.gameId, gameIds))
        : [];

    // 2. Fetch all Discord members to get display names, avatars, and identify unassigned players
    const discordMembers = await getGuildMembers(
      { guildId },
      { cacheFor: TimeSpan.fromMinutes(1) },
    );

    // 3. Fetch member preferences
    const dbPrefs = await db
      .select()
      .from(memberPreference)
      .where(eq(memberPreference.guildId, guildId));
    const prefsMap = new Map(dbPrefs.map((p) => [p.discordUserId, p.sessionsPerMonth]));

    // 4. Fetch availability for the target month
    const submissions = await db
      .select({
        id: availabilitySubmission.id,
        discordUserId: availabilitySubmission.discordUserId,
      })
      .from(availabilitySubmission)
      .where(
        and(
          eq(availabilitySubmission.guildId, guildId),
          eq(availabilitySubmission.year, year),
          eq(availabilitySubmission.month, month),
        ),
      );

    const submissionIds = submissions.map((s) => s.id);
    const availabilityDays =
      submissionIds.length > 0
        ? await db
            .select()
            .from(availabilityDay)
            .where(inArray(availabilityDay.submissionId, submissionIds))
        : [];

    const daysBySubmissionId = new Map<string, (typeof availabilityDays)[0][]>();
    for (const d of availabilityDays) {
      if (!daysBySubmissionId.has(d.submissionId)) {
        daysBySubmissionId.set(d.submissionId, []);
      }
      daysBySubmissionId.get(d.submissionId)!.push(d);
    }

    const availabilityMap = new Map<string, Map<number, string>>();
    for (const sub of submissions) {
      const userDays = new Map<number, string>();
      const days = daysBySubmissionId.get(sub.id) ?? [];
      for (const d of days) {
        userDays.set(d.day, d.status);
      }
      availabilityMap.set(sub.discordUserId, userDays);
    }

    // 5. Fetch scheduled sessions for the month
    const scheduled = await db
      .select()
      .from(scheduledSession)
      .where(
        and(
          eq(scheduledSession.guildId, guildId),
          eq(scheduledSession.year, year),
          eq(scheduledSession.month, month),
        ),
      );

    const gameSchedulesMap = new Map<string, number[]>();
    for (const s of scheduled) {
      if (!gameSchedulesMap.has(s.gameId)) {
        gameSchedulesMap.set(s.gameId, []);
      }
      gameSchedulesMap.get(s.gameId)!.push(s.day);
    }

    // 6. Map everything together
    const discordMembersMap = new Map(discordMembers.map((m) => [m.user.id, m]));

    const mappedGames = games.map((g) => ({
      id: g.id,
      name: g.name,
      status: g.status,
      sessionsPerMonth: g.sessionsPerMonth,
      scheduledDays: gameSchedulesMap.get(g.id) ?? [],
      members: allGameMembers
        .filter((m) => m.gameId === g.id)
        .map((m) => {
          const dm = discordMembersMap.get(m.discordUserId);
          const availability = Object.fromEntries(
            availabilityMap.get(m.discordUserId) ?? new Map(),
          );
          return {
            discordUserId: m.discordUserId,
            displayName: dm ? dm.nick || dm.user.global_name || dm.user.username : 'Unknown',
            avatar: dm?.user.avatar ?? null,
            isRequired: m.isRequired,
            sessionsPerMonth: prefsMap.get(m.discordUserId) ?? null,
            availability,
          };
        })
        .sort((a, b) => {
          // 1. Core members on top
          if (a.isRequired && !b.isRequired) return -1;
          if (!a.isRequired && b.isRequired) return 1;

          // 2. Filled out schedule
          const aHasSchedule = Object.keys(a.availability).length > 0;
          const bHasSchedule = Object.keys(b.availability).length > 0;
          if (aHasSchedule && !bHasSchedule) return -1;
          if (!aHasSchedule && bHasSchedule) return 1;

          // 3. Alphabetical
          return a.displayName.localeCompare(b.displayName);
        }),
    }));

    // 7. Identify unassigned members (with allowed roles/admins, not in any game)
    const assignedDiscordUserIds = new Set(allGameMembers.map((m) => m.discordUserId));
    const unassignedMembers = [];

    for (const m of discordMembers) {
      if (m.user.bot) continue;
      if (assignedDiscordUserIds.has(m.user.id)) continue;

      const role = await resolveRoleForGuild(m.roles, guildId, allowedRoles);
      if (role === 'none') continue;

      unassignedMembers.push({
        discordUserId: m.user.id,
        displayName: m.nick || m.user.global_name || m.user.username,
        avatar: m.user.avatar,
        sessionsPerMonth: prefsMap.get(m.user.id) ?? null,
        availability: Object.fromEntries(availabilityMap.get(m.user.id) ?? new Map()),
      });
    }

    unassignedMembers.sort((a, b) => {
      // 1. Filled out schedule
      const aHasSchedule = Object.keys(a.availability).length > 0;
      const bHasSchedule = Object.keys(b.availability).length > 0;
      if (aHasSchedule && !bHasSchedule) return -1;
      if (!aHasSchedule && bHasSchedule) return 1;

      // 2. Alphabetical
      return a.displayName.localeCompare(b.displayName);
    });

    return {
      games: mappedGames,
      unassignedMembers,
    };
  },
  'Something went wrong fetching the schedule.',
);

export const saveMonthSchedule = asResult(
  'saveMonthSchedule',
  async (guildId: string, year: number, month: number, gameDates: Record<string, number[]>) => {
    await ensureAdmin(guildId);

    // Validate editing window: current month or next month
    const now = getNow();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const targetDate = new Date(year, month - 1);
    const currentDate = new Date(currentYear, currentMonth - 1);
    const nextMonthDate = new Date(currentYear, currentMonth);

    const isCurrent = targetDate.getTime() === currentDate.getTime();
    const isNext = targetDate.getTime() === nextMonthDate.getTime();

    if (!isCurrent && !isNext) {
      throw new ActionError('Schedules can only be edited for the current or next month.');
    }

    await db.transaction(async (tx) => {
      // 1. Delete all existing scheduled sessions for this guild/year/month
      await tx
        .delete(scheduledSession)
        .where(
          and(
            eq(scheduledSession.guildId, guildId),
            eq(scheduledSession.year, year),
            eq(scheduledSession.month, month),
          ),
        );

      // 2. Insert new ones
      const values = [];
      for (const [gameId, days] of Object.entries(gameDates)) {
        for (const day of days) {
          values.push({
            guildId,
            gameId,
            year,
            month,
            day,
          });
        }
      }

      if (values.length > 0) {
        await tx.insert(scheduledSession).values(values);
      }
    });

    revalidatePath(`/g/${guildId}/schedule`);
  },
  'Something went wrong saving the schedule.',
);
