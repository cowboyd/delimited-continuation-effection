import { Context, Delimiter, Operation } from "./types.ts";
import { Do, Resume } from "./control.ts";
import { Ok } from "./result.ts";
import { getContext, setContext } from "./-context.ts";

export function createContext<T>(name: string, defaultValue?: T): Context<T> {
  let context: Context<T> = { name, get, set, expect, defaultValue };

  function* get(): Operation<T | undefined> {
    return (yield Do((routine) =>
      routine.next(Resume(Ok(getContext(context, routine))))
    )) as T | undefined;
  }

  function* set(value: T): Operation<T> {
    return (yield Do((routine) =>
      routine.next(Resume(Ok(setContext(context, routine, value))))
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

export function contextScope<T>(): Delimiter<T, T> {
  return function* context(routine, next) {
    let original = routine.context;
    routine.context = Object.create(original);
    try {
      return yield* next(routine);
    } finally {
      routine.context = original;
    }
  };
}
