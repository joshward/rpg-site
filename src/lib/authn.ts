import { TimeSpan } from 'timespan-ts';
import { DiscordApiError, getGuildMember, getGuildRoles, getGuilds } from '@/lib/discord/api';
import { GuildModel, RoleModel } from '@/lib/discord/models';
import { hasPermission, Permissions } from '@/lib/discord/permissions';

type Role = 'admin' | 'member' | 'none';

async function fetchServerGuildLookup(): Promise<Record<string, GuildModel>> {
  const serverGuilds = await getGuilds({ cacheFor: TimeSpan.fromHours(1) });

  return Object.fromEntries(serverGuilds.map((guild) => [guild.id, guild]));
}

async function fetchGuildRolesLookup(guildId: string): Promise<Record<string, RoleModel>> {
  const roles = await getGuildRoles({ guildId }, { cacheFor: TimeSpan.fromMinutes(30) });

  return Object.fromEntries(roles.map((role) => [role.id, role]));
}

async function resolveRoleForGuild(
  roles: string[],
  guildId: string,
  allowedGuildRoles: string[],
): Promise<Role> {
  const guildRoles = await fetchGuildRolesLookup(guildId);

  let isAllowed = false;

  for (const role of roles) {
    const guildRole = guildRoles[role];
    if (!guildRole) {
      continue;
    }

    // If the user has the admin permission on any role, they are automatically an admin.
    // Stop as soon as we find one.
    if (hasPermission(guildRole.permissions, Permissions.Administrator)) {
      return 'admin';
    }

    if (allowedGuildRoles.includes(role)) {
      // keep going in case we find an admin role
      isAllowed = true;
    }
  }

  return isAllowed ? 'member' : 'none';
}

export async function fetchUserRole(
  discordUserId: string,
  guildId: string,
  allowedGuildRoles: string[],
): Promise<Role> {
  const serverGuilds = await fetchServerGuildLookup();
  if (!(guildId in serverGuilds)) {
    return 'none';
  }

  try {
    const member = await getGuildMember(
      { guildId: guildId, userId: discordUserId },
      { cacheFor: TimeSpan.fromMinutes(30) },
    );

    return await resolveRoleForGuild(member.roles, guildId, allowedGuildRoles);
  } catch (error) {
    if (error instanceof DiscordApiError && error.code === 404) {
      return 'none';
    }
    throw error;
  }
}

export async function fetchUsersGuilds(
  _discordUserId: string,
  discordAccessToken: string,
): Promise<GuildModel[]> {
  const userGuilds = await getGuilds({
    userAuth: discordAccessToken,
    cacheFor: TimeSpan.fromMinutes(30),
  });

  const serverGuilds = await fetchServerGuildLookup();

  return userGuilds.filter((guild) => guild.id in serverGuilds);
}
