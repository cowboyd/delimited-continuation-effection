import type { Operation, Reject, Resolve } from "./types.ts";
import { Do, Resume } from "./control.ts";
import { Err, Ok, Result } from "./result.ts";

export interface Resolver<T> {
  (resolve: Resolve<T>, reject: Reject): () => void;
}

export function action<T>(resolver: Resolver<T>): Operation<T> {
  return {
    *[Symbol.iterator]() {
      let exit = () => {};
      try {
        let value = yield Do(({ next }) => {
          let settle = (result: Result<unknown>) => {
            settle = () => {};
            next(Resume(result));
          };
          let resolve = (value: unknown) => settle(Ok(value));
          let reject = (error: Error) => settle(Err(error));
          try {
            exit = resolver(resolve, reject) ?? (() => {});
          } catch (error) {
            next(Resume(Err(error)));
          }
        });
        return value as T;
      } finally {
        exit();
      }
    },
  };
}
