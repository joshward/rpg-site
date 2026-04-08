import {
  createFetch,
  createSchema,
  type BetterFetchOption,
  type BetterFetchResponse,
} from '@better-fetch/fetch';
import { config } from '@/lib/config';
import {
  ErrorSchema,
  GuildMemberSchema,
  GuildMembersResponseSchema,
  GuildsResponseSchema,
  UserSchema,
  RolesResponseSchema,
  ChannelsResponseSchema,
  MessageSchema,
  ChannelSchema,
  type GuildsResponseModel,
  type UserModel,
  type RolesResponseModel,
  type ChannelsResponseModel,
  type GuildMemberModel,
  type GuildMembersResponseModel,
  type ChannelModel,
  type MessageModel,
} from '@/lib/discord/models';
import * as v from 'valibot';
import { TimeSpan } from 'timespan-ts';

export interface Options {
  userAuth?: string;
  cacheFor?: TimeSpan;
  maxWaitTime?: TimeSpan;
}

const defaultHeaders = {
  Accept: 'application/json',
  'User-Agent': `DiscordBot (${config.siteUrl}, 1.0.0)`,
  Authorization: `Bot ${config.discord.botToken}`,
} as const;

function handleOptions(options: Options): BetterFetchOption {
  const requestInit: BetterFetchOption = {
    headers: {
      ...defaultHeaders,
    },
  };
  let totalWaitedMs = 0;
  const maxWaitMs = options.maxWaitTime?.totalMilliseconds ?? 5000;

  if (options.userAuth) {
    requestInit.headers = {
      ...requestInit.headers,
      Authorization: `Bearer ${options.userAuth}`,
    };
  }

  if (options.cacheFor) {
    requestInit.cache = 'force-cache';
    requestInit.next = {
      revalidate: options.cacheFor.totalSeconds,
    };
    // Ensure that incoming request headers don't bypass our cache
    // Also include Authorization in the cache key to prevent cross-account leakage
    requestInit.headers = {
      ...requestInit.headers,
      'Cache-Control': 'max-age=' + options.cacheFor.totalSeconds,
      Vary: 'Authorization',
    };
  }

  requestInit.retry = {
    type: 'linear',
    attempts: 5,
    delay: 0,
    shouldRetry: async (response: Response | null) => {
      if (!response) {
        return false;
      }

      if (response.status === 429) {
        const resetAfter = response.headers.get('X-RateLimit-Reset-After');
        console.warn(`Discord rate limited`, {
          resetAfter,
          remaining: response.headers.get('X-RateLimit-Remaining'),
          resetTime: response.headers.get('X-RateLimit-Reset'),
          limit: response.headers.get('X-RateLimit-Limit'),
          bucket: response.headers.get('X-RateLimit-Bucket'),
        });
        if (resetAfter) {
          const delayMs = parseFloat(resetAfter) * 1000;

          // Check if this new delay would push us over the total budget
          if (totalWaitedMs + delayMs <= maxWaitMs) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            totalWaitedMs += delayMs;
            return true;
          }
        }
      }
      return false;
    },
  };

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
    '/users/@me': {
      output: UserSchema,
    },
    '/guilds/:guildId/roles': {
      output: RolesResponseSchema,
    },
    '/guilds/:guildId/channels': {
      output: ChannelsResponseSchema,
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
    '/channels/:channelId': {
      output: ChannelSchema,
    },
    '/channels/:channelId/messages': {
      method: 'post',
      input: v.object({
        content: v.string(),
        allowed_mentions: v.optional(
          v.object({
            users: v.optional(v.array(v.string())),
            roles: v.optional(v.array(v.string())),
            everyone: v.optional(v.boolean()),
          }),
        ),
      }),
      output: MessageSchema,
    },
    '/users/@me/channels': {
      method: 'post',
      input: v.object({
        recipient_id: v.string(),
      }),
      output: ChannelSchema,
    },
  }),
  defaultError: ErrorSchema,
});

export class RateLimitError extends Error {
  constructor(
    public route: string,
    message: string,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class DiscordApiError extends Error {
  constructor(
    public route: string,
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = 'DiscordApiError';
  }
}

function toError<TData>(
  route: string,
  result: BetterFetchResponse<TData, v.InferOutput<typeof ErrorSchema>>,
): TData {
  if (result.error) {
    if (result.error.status === 429) {
      throw new RateLimitError(route, result.error.message);
    }

    throw new DiscordApiError(route, result.error.status, result.error.message);
  }

  return result.data;
}

export async function getGuilds(options: Options = {}): Promise<GuildsResponseModel> {
  const result = await $fetch('/users/@me/guilds', {
    ...handleOptions(options),
  });
  return toError('/users/@me/guilds', result);
}

export async function getCurrentUser(options: Options = {}): Promise<UserModel> {
  const result = await $fetch('/users/@me', {
    ...handleOptions(options),
  });
  return toError('/users/@me', result);
}

export async function getGuildRoles(
  params: { guildId: string },
  options: Options = {},
): Promise<RolesResponseModel> {
  const result = await $fetch('/guilds/:guildId/roles', {
    params,
    ...handleOptions(options),
  });
  return toError('/guilds/:guildId/roles', result);
}

export async function getGuildChannels(
  params: { guildId: string },
  options: Options = {},
): Promise<ChannelsResponseModel> {
  const result = await $fetch('/guilds/:guildId/channels', {
    params,
    ...handleOptions(options),
  });
  return toError('/guilds/:guildId/channels', result);
}

export async function getGuildMember(
  params: { guildId: string; userId: string },
  options: Options = {},
): Promise<GuildMemberModel> {
  const result = await $fetch('/guilds/:guildId/members/:userId', {
    params,
    ...handleOptions(options),
  });
  return toError('/guilds/:guildId/members/:userId', result);
}

export async function getGuildMembers(
  params: { guildId: string },
  options: Options = {},
): Promise<GuildMembersResponseModel> {
  const result = await $fetch('/guilds/:guildId/members', {
    params,
    query: {
      limit: 1000,
    },
    ...handleOptions(options),
  });
  return toError('/guilds/:guildId/members', result);
}

export async function getChannel(
  params: { channelId: string },
  options: Options = {},
): Promise<ChannelModel> {
  const result = await $fetch('/channels/:channelId', {
    params,
    ...handleOptions(options),
  });
  return toError('/channels/:channelId', result);
}

export async function sendDiscordMessage(
  params: { channelId: string },
  body: {
    content: string;
    allowed_mentions?: {
      users?: string[];
      roles?: string[];
      everyone?: boolean;
    };
  },
  options: Options = {},
): Promise<MessageModel> {
  const result = await $fetch('/channels/:channelId/messages', {
    method: 'post',
    params,
    body,
    ...handleOptions(options),
  });
  return toError('/channels/:channelId/messages', result);
}

export async function createDM(
  params: { recipient_id: string },
  options: Options = {},
): Promise<ChannelModel> {
  const result = await $fetch('/users/@me/channels', {
    method: 'post',
    body: params,
    ...handleOptions(options),
  });
  return toError('/users/@me/channels', result);
}
