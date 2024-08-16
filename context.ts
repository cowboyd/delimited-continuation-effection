import { Context, Operation } from "./types.ts";
import { useCoroutine } from "./coroutine.ts";
import { getContext, setContext } from "./-context.ts";

export function createContext<T>(name: string, defaultValue?: T): Context<T> {

  let context: Context<T> = { name, get, set, expect, defaultValue };
  
  function* get(): Operation<T | undefined> {
    return getContext(context, yield* useCoroutine());
  }

  function* set(value: T): Operation<T> {
    return setContext(context, yield* useCoroutine(), value);
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
