import { useCoroutine } from "./coroutine.ts";
import { run } from "./run.ts";
import { spawn, Tasks } from "./spawn.ts";
import { halt } from "./task.ts";
import type { Context, Operation, Scope, Task } from "./types.ts";

export function createScope(parent?: Scope): [Scope, () => Task<void>] {
  let contexts: Record<string, unknown> = parent
    ? Object.create(cast(parent).contexts)
    : {};

  let scope = {
    get<T>(context: Context<T>) {
      return contexts[context.name] ?? context.defaultValue;
    },
    set<T>(context: Context<T>, value: T) {
      return contexts[context.name] = value;
    },
    spawn<T>(operation: () => Operation<T>): Operation<Task<T>> {
      return scope.eval(() => spawn(operation));
    },
    *eval<T>(operation: () => Operation<T>): Operation<T> {
      let routine = yield* useCoroutine();
      let originalScope = routine.scope;
      try {
        routine.scope = scope;
        return yield* operation();
      } finally {
        routine.scope = originalScope;
      }
    },
    contexts,
  } as Scope;

  let tasks = scope.set(Tasks, new Set());

  return [scope, () => run(() => halt(tasks))];
}

export function* useScope(): Operation<Scope> {
  let routine = yield* useCoroutine();
  return routine.scope;
}

function cast(scope: Scope): Scope & { contexts: Record<string, unknown> } {
  return scope as Scope & { contexts: Record<string, unknown> };
}
