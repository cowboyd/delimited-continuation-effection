import { controlBounds, useCoroutine } from "./coroutine.ts";
import { Break, Do, Resume } from "./control.ts";
import { Routine } from "./contexts.ts";
import { Err, Ok } from "./result.ts";

import { createTask } from "./task.ts";
import type { Context, Operation, Scope, Task } from "./types.ts";
import { createFutureWithResolvers } from "./future.ts";
import { TaskGroup } from "./task-group.ts";

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
    delete<T>(context: Context<T>) {
      return delete contexts[context.name];
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
      let children = TaskGroup.expect(scope);
      let [child] = createScope(scope);
      let grandchildren = TaskGroup.expect(child);

      let [start, task] = createTask({
        scope: child,
        *operation() {
          return yield* controlBounds(function* () {
	    return yield* TaskGroup.context.with(grandchildren, function* () {
              try {
                return yield* operation();
              } catch (error) {
                scope.get(Routine)?.next(Break(Resume(Err(error))));
                throw error;
              } finally {
                if (typeof task !== "undefined") {
                  children.delete(task);
                }
		yield* grandchildren.halt();
              }
	    });
          });
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

  let tasks = TaskGroup.create(scope);

  return [scope, () => parent!.run(() => tasks.halt())];
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

// let { scope, operation: { name } } = options;
// let result = createFutureWithResolvers<T>();
// let finalized = createFutureWithResolvers<void>();

// let halted = false;

// function* operation(): Operation<void> {
//   try {
//     let value = yield* controlBounds<T>(() =>
//       taskBounds<T>(options.operation)
//     );
//     if (!halted) {
//       result.resolve(value);
//     }
//   } catch (error) {
//     result.reject(error);
//     finalized.reject(error);
//   } finally {
//     finalized.resolve();
//     if (halted) {
//       result.reject(new Error("halted"));
//     }
//   }
// }

// let routine = createCoroutine({ name, operation, scope });

// scope.set(Routine, routine);

// let halt_i = Do(() => {
//   if (!halted) {
//     halted = true;
//     routine.next(routine.stack.haltInstruction);
//   }
// });

// let halt = () => doAndWait(() => routine.next(halt_i), finalized.future);

// let task: Task<T> = Object.create(result.future, {
//   [Symbol.toStringTag]: {
//     enumerable: false,
//     value: "Task",
//   },
//   halt: {
//     enumerable: false,
//     value: halt,
//   },
// });

// return [() => routine.next(Resume(Ok())), task];
