import { Routine } from "./contexts.ts";
import { createCoroutine } from "./coroutine.ts";
import { createFutureWithResolvers, doAndWait } from "./future.ts";
import { Coroutine, Operation, Scope, Task } from "./types.ts";

export interface TaskOptions<T> {
  operation(): Operation<T>;
  scope: Scope;
}

export function createTask<T>(options: TaskOptions<T>): [Task<T>, Coroutine] {
  let { scope, operation: { name } } = options;
  let result = createFutureWithResolvers<T>();
  let finalized = createFutureWithResolvers<void>();

  let halted = false;

  let routine = createCoroutine({
    name,
    scope,
    *operation() {
      try {
        let value = yield* options.operation();
        if (!halted) {
          result.resolve(value);
        }
      } catch (error) {
        result.reject(error);
        finalized.reject(error);
      } finally {
        finalized.resolve();
        if (halted) {
          result.reject(new Error("halted"));
        }
      }
    },
  });

  scope.set(Routine, routine);

  let halt = () =>
    doAndWait(() => {
      if (!halted) {
        halted = true;
        routine.next(routine.stack.haltInstruction);
      }
    }, finalized.future);

  let task: Task<T> = Object.create(result.future, {
    [Symbol.toStringTag]: {
      enumerable: false,
      value: "Task",
    },
    halt: {
      enumerable: false,
      value: halt,
    },
  });

  return [task, routine];
}
