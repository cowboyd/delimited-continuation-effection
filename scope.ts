import { useCoroutine } from "./coroutine.ts";
import { Break, Do, Resume } from "./control.ts";
import { Routine } from "./contexts.ts";
import { Err, Ok } from "./result.ts";
import { Tasks } from "./spawn.ts";
import { createTask, halt } from "./task.ts";
import type { Context, Operation, Scope, Task } from "./types.ts";

export const [global] = createScopeInternal();

export function createScope(parent = global) {
  return createScopeInternal(parent);
}

function createScopeInternal(parent?: Scope): [Scope, () => Task<void>] {
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
    expect<T>(context: Context<T>): T {
      let value = scope.get(context);
      if (typeof value === "undefined") {
        let error = new Error(context.name);
        error.name = `MissingContextError`;
        throw error;
      }
      return value;
    },
    *spawn<T>(operation: () => Operation<T>): Operation<Task<T>> {
      let task = yield Do((routine) =>
        routine.next(Resume(Ok(scope.run(operation))))
      );

      return task as Task<T>;
    },
    run<T>(operation: () => Operation<T>): Task<T> {
      let children = scope.get(Tasks) ?? scope.set(Tasks, new Set());
      let [child] = createScope(scope);
      let [start, task] = createTask({
        scope: child,
        operation: function* child() {
          try {
            return yield* operation();
          } catch (error) {
            scope.get(Routine)?.next(Break(Resume(Err(error))));
            throw error;
          } finally {
            if (typeof task !== "undefined") {
              children.delete(task);
            }
          }
        },
      });
      children.add(task);
      start();
      return task;
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

  scope.set(Tasks, new Set());

  return [scope, () => parent!.run(() => halt(scope.expect(Tasks)))];
}

export function* useScope(): Operation<Scope> {
  let routine = yield* useCoroutine();
  return routine.scope;
}

//TODO, we should not create new tasks per scope.
// also where to put this. name could be better too.
export function* contextBounds<T>(op: () => Operation<T>): Operation<T> {
  let scope = yield* useScope();
  let [child, destroy] = createScope(scope);
  try {
    return yield* child.eval(op);
  } finally {
    yield* destroy();
  }
}

function cast(scope: Scope): Scope & { contexts: Record<string, unknown> } {
  return scope as Scope & { contexts: Record<string, unknown> };
}
