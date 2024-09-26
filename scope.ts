import { useCoroutine } from "./coroutine.ts";
import type { Context, Operation, Scope } from "./types.ts";

export function createScope(parent?: Scope): Scope {
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
    // run<T>(operation: () => Operation<T>): Task<T> {

    // },
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

  return scope;
}

export function* useScope(): Operation<Scope> {
  let routine = yield* useCoroutine();
  return routine.scope;
}

function cast(scope: Scope): Scope & { contexts: Record<string, unknown> } {
  return scope as Scope & { contexts: Record<string, unknown> };
}
