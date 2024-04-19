import { reset, shift } from "./continuation.ts";
import type { Operation } from "./types.ts";
import { withResolvers } from "./with-resolvers.ts";

export interface Task<T> extends Operation<T> {
  halt(): Operation<void>;
}

export function* spawn<T>(op: () => Operation<T>): Operation<Task<T>> {
  return yield* reset(function* () {
    let { operation, resolve, reject } = yield* withResolvers<T>();

    yield* reset(function* () {
      try {
        resolve(yield* op());
      } catch (error) {
        reject(error);
      }
    });

    yield* shift<void, void, Task<T>>(function* (k) {
      return {
        ...operation,
        halt: k,
      };
    });
  });
}
