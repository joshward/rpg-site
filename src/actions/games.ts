'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray, count } from 'drizzle-orm';
import { db } from '@/db/db';
import { asResult, ActionError } from '@/actions/action-helpers';
import { ensureAdmin, ensureAccess } from '@/actions/auth-helpers';
import { game, gameMember, gameStatusEnum, GameStatus } from '@/db/schema/games';
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
