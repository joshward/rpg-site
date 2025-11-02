import { getGuildMember, getGuildRoles, getGuilds } from '@/lib/discord/api';
import { GuildModel, RoleModel } from '@/lib/discord/models';
import { hasPermission, Permissions } from '@/lib/discord/permissions';

export interface Role {
  guildId: string;
  role: 'admin' | 'member' | 'none';
}

async function getServerGuildLookup(): Promise<Map<string, GuildModel> | undefined> {
  const serverGuilds = await getGuilds();
  if (serverGuilds.error) {
    console.error('Failed to fetch server guilds', serverGuilds.error);
    return undefined;
  }

  return new Map(serverGuilds.data?.map((guild) => [guild.id, guild]) ?? []);
}

async function getGuildRoleLookup(guildId: string): Promise<Map<string, RoleModel> | undefined> {
  const roles = await getGuildRoles(guildId);
  if (roles.error) {
    console.error(`Failed to fetch guild (${guildId}) roles`, roles.error);
    return undefined;
  }

  return new Map(roles.data?.map((role) => [role.id, role]) ?? []);
}

async function resolveRoleForGuild(roles: string[], guildId: string): Promise<Role['role']> {
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
  }

  return 'none';
}

export async function getUsersRoles(userId: string, accessToken: string): Promise<Role[]> {
  const userGuilds = await getGuilds({ userTokenOverride: accessToken });
  if (userGuilds.error) {
    console.error(`Failed to fetch user (${userId}) guilds`, userGuilds.error);
    return [];
  }

  const serverGuilds = await getServerGuildLookup();
  if (!serverGuilds) {
    return [];
  }

  const roles: Role[] = [];
  for (const userGuild of userGuilds.data) {
    const guild = serverGuilds.get(userGuild.id);
    if (!guild) {
      continue;
    }

    const member = await getGuildMember(guild.id, userId);
    if (member.error) {
      console.error(
        `Failed to fetch guild (${guild.id}) member info for user (${userId})`,
        member.error,
      );
      continue;
    }

    const role = await resolveRoleForGuild(member.data.roles, guild.id);

    roles.push({ guildId: guild.id, role });
  }

  return roles;
}
