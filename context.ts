import { Operation } from "./types.ts";
import { useCoroutine } from "./coroutine.ts";

export interface Context<T> {
  name: string;
  get(): Operation<T | undefined>;
  set(value: T): Operation<T>;
  expect(): Operation<T>;
}

export function createContext<T>(name: string, defaultValue?: T): Context<T> {

  function* get(): Operation<T | undefined> {
    let routine = yield* useCoroutine();
    return (routine.context[name] ?? defaultValue) as T | undefined;
  }

  function* set(value: T): Operation<T> {
    let routine = yield* useCoroutine();
    return routine.context[name] = value;
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
  
  return { name, get, set, expect };
}
