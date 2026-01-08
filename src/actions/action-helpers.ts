import { Result } from './result';
import { DiscordApiError, RateLimitError } from '@/lib/discord/api';

export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionError';
  }
}

export function asResult<T, Args extends any[]>(
  methodName: string,
  action: (...args: Args) => Promise<T>,
  errorMessage: string = 'An unexpected error occurred. Please try again later.',
): (...args: Args) => Promise<Result<T>> {
  return async (...args: Args) => {
    try {
      const data = await action(...args);
      return { type: 'success', data };
    } catch (error: unknown) {
      if (error instanceof RateLimitError) {
        console.warn(
          `Error calling ${methodName}: Discord API rate limit exceeded. [${error.route}]`,
        );
        return {
          type: 'failure',
          error: 'Discord API rate limit exceeded. Please try again later.',
        };
      }

      if (error instanceof DiscordApiError) {
        console.error(
          `Error calling ${methodName} - Discord API error [${error.route}] (${error.code}):`,
          error.message,
        );
      } else {
        console.error(`Error calling ${methodName}:`, error);
      }

      if (error instanceof ActionError) {
        return { type: 'failure', error: error.message };
      }

      return { type: 'failure', error: errorMessage };
    }
  };
}

export function unwrapData<T>(result: Result<T>): T | undefined {
  if (result.type === 'success') {
    return result.data;
  }
}
