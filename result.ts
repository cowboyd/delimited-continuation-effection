export type Result<T> = {
  readonly ok: true;
  value: T;
} | {
  readonly ok: false;
  error: Error;
};

export const Ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const Err = <T>(error: Error): Result<T> => ({ ok: false, error });

export function box<T>(fn: () => T): Result<T> {
  try {
    return Ok(fn());
  } catch (error) {
    return Err(error);
  }
}

export function unbox<T>(result: Result<T>): T {
  if (result.ok) {
    return result.value;
  } else {
    throw result.error;
  }
}
