import { Result } from './result';

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
      return { type: 'failure', error: errorMessage };
    }
  };
}
