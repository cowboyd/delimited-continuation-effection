import { contextScope } from "./context.ts";
import { controlScope } from "./coroutine.ts";
import { spawnScope } from "./task.ts";
import { Operation } from "./types.ts";

export function* scoped<T>(op: () => Operation<T>): Operation<T> {
  return yield* contextScope<T>(() => controlScope<T>(() => spawnScope<T>(op)));
}
