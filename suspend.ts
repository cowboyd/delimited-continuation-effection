import { Suspend } from "./coroutine.ts";
import type { Operation, Unsuspend } from "./types.ts";

export function suspend(): Operation<void>;
export function suspend<T = void>(resume: Unsuspend<T>): Operation<T>;
export function suspend(unsuspend?: Unsuspend<unknown>): Operation<unknown> {
  return {
    *[Symbol.iterator]() {
      return yield Suspend(unsuspend);
    },
  };
}
