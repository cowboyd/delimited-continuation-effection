import { Do, Resume } from "./control.ts";
import { Err, Ok, Result } from "./result.ts";
import type { Operation, Reject, Resolve } from "./types.ts";

export function suspend(): Operation<void>;
export function suspend<T>(resume: Resolver<T>): Operation<T>;
export function suspend(unsuspend?: Resolver<unknown>): Operation<unknown> {
  return {
    *[Symbol.iterator]() {
      let exit = () => {};
      try {
        let value = yield Do(({ next }) => {
          if (unsuspend) {
            let settlement: Result<unknown> | void = void 0;
            let settle = (result: Result<unknown>) => {
              if (!settlement) {
                settlement = result;
                next(Resume(settlement));
              }
            };
            let resolve = (value: unknown) => settle(Ok(value));
            let reject = (error: Error) => settle(Err(error));
            try {
              exit = unsuspend(resolve, reject) ?? (() => {});
            } catch (error) {
              next(Resume(Err(error)));
            }
          }
        });
        return value;
      } finally {
        exit();
      }
    },
  };
}

export interface Resolver<T> {
  (resolve: Resolve<T>, reject: Reject): () => void;
}
