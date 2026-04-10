import { db } from '@/db/db';
import { game, gameMember } from '@/db/schema/games';
import { memberPreference } from '@/db/schema/member-preferences';
import { availabilitySubmission } from '@/db/schema/availability';
import { eq, and, inArray } from 'drizzle-orm';
import { getGuildMembers } from '@/lib/discord/api';
import { resolveRoleForGuild } from '@/lib/authn';

export interface PlayerCohorts {
  corePlayers: any[];
  optionalPlayers: any[];
  missingCore: any[];
  missingOptional: any[];
  submittedUserIds: Set<string>;
}

export async function getPlayerCohorts({
  guildId,
  allowedRoles,
  target,
}: {
  guildId: string;
  allowedRoles: string[];
  target: { year: number; month: number };
}): Promise<PlayerCohorts> {
  const members = await getGuildMembers({ guildId });
  const prefs = await db
    .select()
    .from(memberPreference)
    .where(eq(memberPreference.guildId, guildId));
  const activeGames = await db
    .select()
    .from(game)
    .where(and(eq(game.guildId, guildId), eq(game.status, 'active')));
  const activeGameIds = activeGames.map((g) => g.id);

  const gameMembershipsMap = new Map<string, any[]>();
  if (activeGameIds.length > 0) {
    const gameMemberships = await db
      .select()
      .from(gameMember)
      .where(inArray(gameMember.gameId, activeGameIds));
    for (const gm of gameMemberships) {
      if (!gameMembershipsMap.has(gm.discordUserId)) {
        gameMembershipsMap.set(gm.discordUserId, []);
      }
      gameMembershipsMap.get(gm.discordUserId)!.push(gm);
    }
  }

  const submissions = await db
    .select()
    .from(availabilitySubmission)
    .where(
      and(
        eq(availabilitySubmission.guildId, guildId),
        eq(availabilitySubmission.year, target.year),
        eq(availabilitySubmission.month, target.month),
      ),
    );

  const submittedUserIds = new Set(submissions.map((s) => s.discordUserId));
  const prefsMap = new Map(prefs.map((p) => [p.discordUserId, p.sessionsPerMonth]));

  const corePlayers: any[] = [];
  const optionalPlayers: any[] = [];

  for (const m of members) {
    if (m.user.bot) continue;

    const role = await resolveRoleForGuild(m.roles, guildId, allowedRoles);
    if (role === 'none') continue;

    const sessionsPref = prefsMap.get(m.user.id);
    if (sessionsPref === 0) continue;

    const userGames = gameMembershipsMap.get(m.user.id) || [];
    const isRequired = userGames.some((gm) => gm.isRequired);

    if (isRequired) {
      corePlayers.push(m);
    } else {
      optionalPlayers.push(m);
    }
  }

  const missingCore = corePlayers.filter((p) => !submittedUserIds.has(p.user.id));
  const missingOptional = optionalPlayers.filter((p) => !submittedUserIds.has(p.user.id));

  return {
    corePlayers,
    optionalPlayers,
    missingCore,
    missingOptional,
    submittedUserIds,
  };
}
