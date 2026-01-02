import { TimeSpan } from 'timespan-ts';
import { getGuildMember, getGuildRoles, getGuilds } from '@/lib/discord/api';
import { GuildModel, RoleModel } from '@/lib/discord/models';
import { hasPermission, Permissions } from '@/lib/discord/permissions';

type Role = 'admin' | 'member' | 'none';

async function getServerGuildLookup(): Promise<Record<string, GuildModel>> {
  const serverGuilds = await getGuilds({ cacheFor: TimeSpan.fromHours(1) });

  if (serverGuilds.error) {
    throw new Error(`Failed to fetch server guilds: ${serverGuilds.error.message}`);
  }

  return Object.fromEntries(serverGuilds.data.map((guild) => [guild.id, guild]));
}

async function getGuildRoleLookup(guildId: string): Promise<Map<string, RoleModel> | undefined> {
  const roles = await getGuildRoles({ guildId });
  if (roles.error) {
    console.error(`Failed to fetch guild (${guildId}) roles`, roles.error);
    return undefined;
  }

  return new Map(roles.data?.map((role) => [role.id, role]) ?? []);
}

async function resolveRoleForGuild(roles: string[], guildId: string): Promise<Role> {
  const guildRoles = await getGuildRoleLookup(guildId);
  if (!guildRoles) {
    return 'none';
  }

  for (const role of roles) {
    const guildRole = guildRoles.get(role);
    if (!guildRole) {
      continue;
    }

    // If the user has the admin permission on any role, they are automatically an admin.
    // Stop as soon as we find one.
    if (hasPermission(guildRole.permissions, Permissions.Administrator)) {
      return 'admin';
    }

    // TODO - match app role based on Discord role
  }

  return 'none';
}

export async function fetchUserRole(discordUserId: string, guildId: string): Promise<Role> {
  const serverGuilds = await getServerGuildLookup();
  if (!(guildId in serverGuilds)) {
    throw new Error(`Guild (${guildId}) not found in server guilds`);
  }

  const member = await getGuildMember({ guildId: guildId, userId: discordUserId });
  if (member.error) {
    throw new Error(
      `Failed to fetch guild (${guildId}) member info for discord user (${discordUserId})`,
    );
  }

  return await resolveRoleForGuild(member.data.roles, guildId);
}

export async function fetchUsersGuilds(
  discordUserId: string,
  discordAccessToken: string,
): Promise<GuildModel[]> {
  const userGuilds = await getGuilds({
    userAuth: discordAccessToken,
    cacheFor: TimeSpan.fromMinutes(30),
  });
  if (userGuilds.error) {
    console.error(`Failed to fetch discord user (${discordUserId}) guilds`, userGuilds.error);
    return [];
  }

  const serverGuilds = await getServerGuildLookup();

  return userGuilds.data.filter((guild) => guild.id in serverGuilds);
}
