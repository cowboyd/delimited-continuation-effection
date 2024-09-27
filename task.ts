import { createContext } from "./context.ts";
import { Routine } from "./contexts.ts";
import { Do, Resume } from "./control.ts";
import { controlBounds, createCoroutine } from "./coroutine.ts";
import { createFutureWithResolvers, doAndWait } from "./future.ts";
import { Err, Ok } from "./result.ts";
import { Coroutine, Operation, Scope, Task } from "./types.ts";

export interface TaskOptions<T> {
  operation(): Operation<T>;
  scope: Scope;
}

export function createTask<T>(options: TaskOptions<T>): [() => void, Task<T>] {
  let { scope, operation: { name } } = options;
  let result = createFutureWithResolvers<T>();
  let finalized = createFutureWithResolvers<void>();

  let halted = false;

  function* operation(): Operation<void> {
    try {
      let value = yield* controlBounds<T>(() =>
        taskBounds<T>(options.operation)
      );
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
  }

  let routine = createCoroutine({ name, operation, scope });

  scope.set(Routine, routine);

  let halt_i = Do(() => {
    if (!halted) {
      halted = true;
      routine.next(routine.stack.haltInstruction);
    }
  });

  let halt = () => doAndWait(() => routine.next(halt_i), finalized.future);

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

  return [() => routine.next(Resume(Ok())), task];
}

const Tasks = createContext<Set<Task<unknown>>>("@effection/tasks");

export function* halt(tasks: Set<Task<unknown>>): Operation<void> {
  let teardown = Ok();
  while (tasks.size > 0) {
    for (let child of [...tasks].reverse()) {
      try {
        yield* child.halt();
      } catch (error) {
        teardown = Err(error);
      } finally {
        tasks.delete(child);
      }
    }
  }
  if (!teardown.ok) {
    throw teardown.error;
  }
}

export function* taskBounds<T>(op: () => Operation<T>): Operation<T> {
  let tasks = yield* Tasks.set(new Set());
  try {
    return yield* op();
  } finally {
    yield* halt(tasks);
  }
}
