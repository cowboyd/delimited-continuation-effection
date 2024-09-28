import { Context, Operation } from "./types.ts";
import { Do, Resume } from "./control.ts";
import { Ok } from "./result.ts";

export function createContext<T>(name: string, defaultValue?: T): Context<T> {
  let context: Context<T> = { name, get, set, expect, defaultValue };

  function* get(): Operation<T | undefined> {
    return (yield Do(({ next, scope }) =>
      next(Resume(Ok(scope.get(context))))
    )) as T | undefined;
  }

  function* set(value: T): Operation<T> {
    return (yield Do(({ next, scope }) =>
      next(Resume(Ok(scope.set(context, value))))
    )) as T;
  }

  function* expect(): Operation<T> {
    let value = yield* get();
    if (!value) {
      let error = new Error(name);
      error.name = `MissingContextError`;
      throw error;
    }
    return value;
  }

  return context;
}
