import { contextScope } from "./context.ts";
import { controlScope, useCoroutine } from "./coroutine.ts";
import { spawnScope } from "./task.ts";
import { Operation } from "./types.ts";

export function* scoped<T>(op: () => Operation<T>): Operation<T> {
  let routine = yield* useCoroutine();

  return yield* contextScope<T>()(
    routine,
    () => controlScope<T>(() => spawnScope<T>()(routine, op)),
  );
}
