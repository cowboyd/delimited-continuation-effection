import { Suspend, Unsuspend } from "./control.ts";
import type { Operation } from "./types.ts";

export function suspend(): Operation<void>;
export function suspend<T>(resume: Unsuspend<T>): Operation<T>;
export function suspend(unsuspend?: Unsuspend<unknown>): Operation<unknown> {
  return {
    *[Symbol.iterator]() {
      return yield* (yield Suspend(unsuspend)) as Operation<unknown>;
    },
  };
}
