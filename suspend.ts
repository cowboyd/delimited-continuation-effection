import { Operation, Reject, Resolve } from "./types.ts";

export function suspend(): Operation<void>;
export function suspend<T = void>(resume: Resume<T>): Operation<T>;
export function suspend(resume?: Resume<unknown>): Operation<unknown> {
  return {
    *[Symbol.iterator]() {
      return (yield { type: "suspend", resume });
    },
  };
}

export interface Resume<T> {
  (resolve: Resolve<T>, reject: Reject): () => void;
}
