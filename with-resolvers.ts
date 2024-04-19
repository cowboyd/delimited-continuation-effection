import { reset, shift } from "./continuation.ts";
import { Err, Ok, Result, unbox } from "./result.ts";
import type { Continuation, Operation } from "./types.ts";

export interface WithResolvers<T> {
  operation: Operation<T>;
  resolve(value: T): void;
  reject(error: Error): void;
}

export function* withResolvers<T>(): Operation<WithResolvers<T>> {
  return yield* reset(function* () {
    let waiters = new Set<Continuation<void, void>>();
    let result: Result<T>;
    result = yield* shift<Result<T>, void, WithResolvers<T>>(
      function* (k, reenter) {
        let operation: Operation<T> = {
          *[Symbol.iterator]() {
            if (!result) {
              yield* shift<void, void, void>(function* (k) {
                try {
                  waiters.add(k);
                  yield* shift(function* () {});
                } finally {
                  waiters.delete(k);
                }
              });
            }
            return unbox(result);
          },
        };

        return {
          operation,
          resolve: (value) => reenter(k, Ok(value)),
          reject: (error) => reenter(k, Err(error)),
        };
      },
    );
    for (let awaken of waiters) {
      yield* awaken();
    }
  });
}
