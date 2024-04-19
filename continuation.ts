import type { Continuation, Operation, ReEnter } from "./types.ts";

export function reset<T>(block: () => Operation<unknown>): Operation<T> {
  return {
    *[Symbol.iterator]() {
      return (yield { type: "reset", block }) as T;
    },
  };
}

export function shift<T, R, O>(
  block: (k: Continuation<T, R>, reenter: ReEnter<T>) => Operation<O>,
): Operation<T> {
  return {
    *[Symbol.iterator]() {
      return (yield { type: "shift", block }) as T;
    },
  };
}
