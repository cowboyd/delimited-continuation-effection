import { Err, Ok, Result, unbox } from "./result.ts";
import { suspend } from "./suspend.ts";
import type { Operation, Reject, Resolve } from "./types.ts";

export interface WithResolvers<T> {
  operation: Operation<T>;
  resolve(value: T): void;
  reject(error: Error): void;
}

export function withResolvers<T>(): WithResolvers<T> {
  let waiters = new Set<Resolve<void>>();
  let $result: Result<T> | undefined = undefined;

  let notify = () => {
    for (let awaken of waiters) {
      awaken();
    }
  };

  let resolve: Resolve<T> = (value) => {
    if (!$result) {
      $result = Ok(value);
      notify();
    }
  };

  let reject: Reject = (error) => {
    if (!$result) {
      $result = Err(error);
      notify();
    }
  };

  let operation: Operation<T> = {
    *[Symbol.iterator]() {
      if (!$result) {
        yield* suspend((resolve) => {
          waiters.add(resolve);
          return () => waiters.delete(resolve);
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
