import { Result } from './result';

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
      console.error(`Error calling ${methodName}:`, error);

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
