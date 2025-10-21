import { createFetch, createSchema } from '@better-fetch/fetch';
import { config } from '@/lib/config';
import {
  ErrorSchema,
  GuildMemberSchema,
  GuildsResponseSchema,
  RolesResponseSchema,
} from '@/lib/discord/models';

type HeaderOverrides = { userTokenOverride?: string };

const defaultHeaders = {
  'Content-Type': 'application/json',
  'User-Agent': `DiscordBot (${config.siteUrl}, 1.0.0)`,
  Authorization: `Bot ${config.discord.botToken}`,
} as const;

function getHeaders({ userTokenOverride }: HeaderOverrides = {}): Record<string, string> {
  return {
    ...defaultHeaders,
    ...(userTokenOverride
      ? {
          Authorization: `Bearer ${userTokenOverride}`,
        }
      : undefined),
  };
}

const $fetch = createFetch({
  baseURL: config.discord.apiUrl,
  headers: defaultHeaders,
  schema: createSchema({
    '/users/@me/guilds': {
      output: GuildsResponseSchema,
    },
    '/guilds/:guildId/roles': {
      output: RolesResponseSchema,
    },
    '/guilds/:guildId/members/:userId': {
      output: GuildMemberSchema,
    },
  }),
  defaultError: ErrorSchema,
});

export function getGuilds(headerOverrides: HeaderOverrides = {}) {
  return $fetch('/users/@me/guilds', {
    headers: getHeaders(headerOverrides),
  });
}

export function getGuildRoles(guildId: string) {
  return $fetch('/guilds/:guildId/roles', {
    params: {
      guildId,
    },
  });
}

export function getGuildMember(guildId: string, userId: string) {
  return $fetch('/guilds/:guildId/members/:userId', {
    params: {
      guildId,
      userId,
    },
  });
}
