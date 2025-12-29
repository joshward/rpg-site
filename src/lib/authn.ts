import { TimeSpan } from 'timespan-ts';
import { getGuildMember, getGuildRoles, getGuilds } from '@/lib/discord/api';
import { GuildModel, RoleModel } from '@/lib/discord/models';
import { hasPermission, Permissions } from '@/lib/discord/permissions';

export interface Role {
  guildId: string;
  role: 'admin' | 'member' | 'none';
}

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
  const userGuilds = await getGuilds({ userAuth: accessToken, cacheFor: TimeSpan.fromMinutes(30) });
  if (userGuilds.error) {
    console.error(`Failed to fetch user (${userId}) guilds`, userGuilds.error);
    return [];
  }

  const serverGuilds = await getServerGuildLookup();

  const roles: Role[] = [];
  for (const userGuild of userGuilds.data) {
    const guild = serverGuilds[userGuild.id];
    if (!guild) {
      continue;
    }

    const member = await getGuildMember({ guildId: guild.id, userId });
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
