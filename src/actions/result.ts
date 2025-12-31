export interface Success<T> {
  type: 'success';
  data: T;
}

export interface Failure {
  type: 'failure';
  error: string;
}

export type Result<T = never> = Success<T> | Failure;

export const isSuccess = <T>(result: Result<T>): result is Success<T> => result.type === 'success';
export const isFailure = <T>(result: Result<T>): result is Failure => result.type === 'failure';
