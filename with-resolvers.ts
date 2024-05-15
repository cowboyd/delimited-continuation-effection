import { Err, Ok, Result, unbox } from "./result.ts";
import { suspend } from "./suspend.ts";
import type { Operation, Reject, Resolve } from "./types.ts";

export interface WithResolvers<T> {
  operation: Operation<T>;
  resolve(value: T): void;
  reject(error: Error): void;
}

export function withResolvers<T>(): WithResolvers<T> {
  let continuations = new Set<Resolve<void>>();
  let $result: Result<T> | undefined = undefined;

  let resumeAll = () => {
    for (let continuation of continuations) {
      continuation();
    }
  };

  let resolve: Resolve<T> = (value) => {
    if (!$result) {
      $result = Ok(value);
      resumeAll();
    }
  };

  let reject: Reject = (error) => {
    if (!$result) {
      $result = Err(error);
      resumeAll();
    }
  };

  let operation: Operation<T> = {
    *[Symbol.iterator]() {
      if (!$result) {
        yield* suspend((resolve) => {
          continuations.add(resolve);
          return () => continuations.delete(resolve);
        });
      }
      return unbox($result!);
    },
  };

  return {
    operation,
    resolve,
    reject,
  };
}
