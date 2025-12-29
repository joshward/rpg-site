import { createFetch, createSchema } from '@better-fetch/fetch';
import { config } from '@/lib/config';
import {
  ErrorSchema,
  GuildMemberSchema,
  GuildMembersResponseSchema,
  GuildsResponseSchema,
  RolesResponseSchema,
} from '@/lib/discord/models';
import * as v from 'valibot';
import { TimeSpan } from 'timespan-ts';

export interface Options {
  userAuth?: string;
  cacheFor?: TimeSpan;
}

const defaultHeaders = {
  'Content-Type': 'application/json',
  'User-Agent': `DiscordBot (${config.siteUrl}, 1.0.0)`,
  Authorization: `Bot ${config.discord.botToken}`,
} as const;

function handleOptions(options: Options): RequestInit {
  const requestInit: RequestInit = {};

  if (options.userAuth) {
    requestInit.headers = {
      ...defaultHeaders,
      Authorization: `Bearer ${options.userAuth}`,
    };
  }

  if (options.cacheFor) {
    requestInit.cache = 'force-cache';
    requestInit.next = {
      revalidate: options.cacheFor.totalSeconds,
    };
  }

  return requestInit;
}

function record(args: Parameters<typeof fetch>) {
  const startTime = Date.now();

  return async () => {
    const endTime = Date.now();
    const input = args[0];
    const init = args[1];
    const headers = init?.headers;
    let authType = '';

    if (headers) {
      const authHeader =
        headers instanceof Headers
          ? headers.get('Authorization')
          : Array.isArray(headers)
            ? undefined
            : (headers as Record<string, string>)?.['Authorization'];

      if (authHeader) {
        const match = authHeader.match(/^(Bearer|Bot)\s/);
        authType = match ? ` [${match[1]}]` : '';
      }
    }

    let cache: string;
    const requestTime = endTime - startTime;
    if (init?.cache === 'force-cache') {
      cache = `Cache ${init.next?.revalidate ? `(${init.next?.revalidate}s ttl)` : ''} `;

      if (endTime - startTime < 50) {
        cache += `[Hit (${requestTime}ms)]`;
      } else {
        cache = `[Miss (${requestTime}ms)]`;
      }
    } else {
      cache = `No Cache (${requestTime}ms)`;
    }

    console.log(`API request${authType} (${input}) | ${cache}`);
  };
}

const $fetch = createFetch({
  customFetchImpl: (...args) => fetch(...args).finally(record(args)),
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
    '/guilds/:guildId/members': {
      output: GuildMembersResponseSchema,
      query: v.object({
        limit: v.optional(v.number()),
        after: v.optional(v.string()),
      }),
    },
  }),
  defaultError: ErrorSchema,
});

export function getGuilds(options: Options = {}) {
  return $fetch('/users/@me/guilds', {
    ...handleOptions(options),
  });
}

export function getGuildRoles(params: { guildId: string }, options: Options = {}) {
  return $fetch('/guilds/:guildId/roles', {
    params,
    ...handleOptions(options),
  });
}

export function getGuildMember(params: { guildId: string; userId: string }, options: Options = {}) {
  return $fetch('/guilds/:guildId/members/:userId', {
    params,
    ...handleOptions(options),
  });
}

export function getGuildMembers(params: { guildId: string }, options: Options = {}) {
  return $fetch('/guilds/:guildId/members', {
    params,
    query: {
      limit: 1000,
    },
    ...handleOptions(options),
  });
}
