import { Context, Coroutine } from "./types.ts";

export function getContext<T>(
  context: Context<T>,
  routine: Coroutine,
): T | undefined {
  return (routine.context[context.name] ?? context.defaultValue) as
    | T
    | undefined;
}

export function setContext<T>(
  context: Context<T>,
  routine: Coroutine,
  value: T,
): T {
  return routine.context[context.name] = value;
}
