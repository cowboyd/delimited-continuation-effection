import { Context, Operation } from "./types.ts";
import { Do, Resume } from "./control.ts";
import { Ok } from "./result.ts";

export function createContext<T>(name: string, defaultValue?: T): Context<T> {
  let context: Context<T> = {
    name,
    defaultValue,
    *get(): Operation<T | undefined> {
      return (yield Do(({ next, scope }) =>
        next(Resume(Ok(scope.get(context))))
      )) as T | undefined;
    },
    *set(value: T): Operation<T> {
      return (yield Do(({ next, scope }) =>
        next(Resume(Ok(scope.set(context, value))))
      )) as T;
    },
    *expect(): Operation<T> {
      let value = yield* context.get();
      if (!value) {
        let error = new Error(name);
        error.name = `MissingContextError`;
        throw error;
      }
      return value;
    },
    *delete(): Operation<boolean> {
      return (yield Do(({ next, scope }) =>
        next(Resume(Ok(scope.delete(context))))
      )) as boolean;
    },
    *with<R>(value: T, operation: (value: T) => Operation<R>): Operation<R> {
      let original = yield* context.get();
      try {
        return yield* operation(yield* context.set(value));
      } finally {
        if (typeof original === "undefined") {
          yield* context.delete();
        } else {
          yield* context.set(original);
        }
      }
    },
  };

  return context;
}
