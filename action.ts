import { Err, Ok } from "./result.ts";
import { Action, Operation } from "./types.ts";

interface Resolver<T> {
  (resolve: (value: T) => void, reject: (error: Error) => void): () => void;
}

export function action<T>(resolver: Resolver<T>, desc?: string): Operation<T> {
  return {
    *[Symbol.iterator]() {
      let action: Action<T> = {
        description: desc ?? "action",
        enter: (settle) => {
          let resolve = (value: T) => {
            settle(Ok(value));
          };
          let reject = (error: Error) => {
            settle(Err(error));
          };
          let discard = resolver(resolve, reject);
          return (discarded) => {
            try {
              discard();
              discarded(Ok());
            } catch (error) {
              discarded(Err(error));
            }
          };
        },
      };
      return (yield action) as T;
    },
  };
}
