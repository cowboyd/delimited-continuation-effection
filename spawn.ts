import type { Operation, Task } from "./types.ts";

export function spawn<T>(block: () => Operation<T>): Operation<Task<T>> {
  return {
    *[Symbol.iterator]() {
      return (yield { type: "spawn", block }) as Task<T>;
    }
  }
}
