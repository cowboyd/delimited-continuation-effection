import type { Operation, Task } from "./types.ts";
import { useScope } from "./scope.ts";

export function spawn<T>(op: () => Operation<T>): Operation<Task<T>> {
  return {
    *[Symbol.iterator]() {
      let scope = yield* useScope();
      return yield* scope.spawn(op);
    },
  };
}
