import { Err, Ok, Result, unbox } from "./result.ts";
import { suspend } from "./suspend.ts";
import type { Operation, Resolve } from "./types.ts";

export interface WithResolvers<T> {
  operation: Operation<T>;
  resolve(value: T): void;
  reject(error: Error): void;
}

export function withResolvers<T>(): WithResolvers<T> {
  let continuations = new Set<Resolve<void>>();
  let result: Result<T> | undefined = undefined;

  let operation: Operation<T> = {
    *[Symbol.iterator]() {
      if (!result) {
        yield* suspend<void>((resolve) => {
          continuations.add(resolve);
          return () => {
            continuations.delete(resolve);
          };
        });
      }
      return unbox(result!);
    },
  };

  let settle = (outcome: Result<T>) => {
    if (!result) {
      result = outcome;
    }
    for (let continuation of continuations) {
      continuation();
    }
  };

  let resolve = (value: T) => settle(Ok(value));
  let reject = (error: Error) => settle(Err(error));

  return { operation, resolve, reject };
}
