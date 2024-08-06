import type { Operation, Task } from "./types.ts";

export function spawn<T>(op: () => Operation<T>): Operation<Task<T>> {
  return {
    *[Symbol.iterator]() {
      return (yield { handler: "@effection/task.spawn", data: op }) as Task<T>;
    },
  };
}
