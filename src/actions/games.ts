'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray, count } from 'drizzle-orm';
import { db } from '@/db/db';
import { asResult, ActionError } from '@/actions/action-helpers';
import { ensureAdmin, ensureAccess } from '@/actions/auth-helpers';
import { game, gameMember, gameStatusEnum, GameStatus } from '@/db/schema/games';
import { availabilitySubmission, availabilityDay } from '@/db/schema/availability';
import { memberPreference } from '@/db/schema/member-preferences';
import { account } from '@/db/schema/auth';
import { getGuildMembers } from '@/lib/discord/api';
import { resolveRoleForGuild } from '@/lib/authn';

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
    const discordMembers = await getGuildMembers({ guildId });
    const discordMembersMap = new Map(discordMembers.map((m) => [m.user.id, m]));

    // 4. Combine them
    return userGames.map((g) => ({
      ...g,
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

    const members = await getGuildMembers({ guildId });

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
    const discordMembers = await getGuildMembers({ guildId });

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
        discordUserId: account.accountId,
      })
      .from(availabilitySubmission)
      .innerJoin(
        account,
        and(eq(account.userId, availabilitySubmission.userId), eq(account.providerId, 'discord')),
      )
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

    const availabilityMap = new Map<string, Map<number, string>>();
    for (const sub of submissions) {
      const userDays = new Map<number, string>();
      availabilityDays
        .filter((d) => d.submissionId === sub.id)
        .forEach((d) => userDays.set(d.day, d.status));
      availabilityMap.set(sub.discordUserId, userDays);
    }

    // 5. Map everything together
    const discordMembersMap = new Map(discordMembers.map((m) => [m.user.id, m]));

    const mappedGames = games.map((g) => ({
      id: g.id,
      name: g.name,
      status: g.status,
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

    // 6. Identify unassigned members (with allowed roles/admins, not in any game)
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
