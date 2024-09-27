import { createContext } from "./context.ts";
import { Do, Instruction, Resume } from "./control.ts";
import { controlBounds, createCoroutine } from "./coroutine.ts";
import { createFutureWithResolvers } from "./future.ts";
import { Err, Ok } from "./result.ts";
import { Coroutine, Future, Operation, Scope, Task } from "./types.ts";

export interface TaskOptions<T> {
  operation(): Operation<T>;
  reduce?(routine: Coroutine, instruction: Instruction): void;
  scope: Scope;
}

export function createTask<T>(options: TaskOptions<T>): [() => void, Task<T>] {
  let { reduce, scope, operation: { name } } = options;
  let result = createFutureWithResolvers<T>();
  let finalized = createFutureWithResolvers<void>();

  let state = { halted: false };

  function* operation(): Operation<void> {
    try {
      let value = yield* controlBounds<T>(() =>
        taskBounds<T>(options.operation)
      );
      if (!state.halted) {
        result.resolve(value);
      }
    } catch (error) {
      result.reject(error);
      finalized.reject(error);
    } finally {
      finalized.resolve();
      if (state.halted) {
        result.reject(new Error("halted"));
      }
    }
  }

  let routine = createCoroutine({ name, operation, reduce, scope });

  let halt_i = Do(() => {
    if (!state.halted) {
      state.halted = true;
      routine.next(routine.stack.haltInstruction);
    }
  });

  let halt = () => createHalt(routine, finalized.future, halt_i);

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

function createHalt(
  routine: Coroutine,
  finalized: Future<void>,
  halt_i: Instruction,
): Future<void> {
  return {
    [Symbol.toStringTag]: "Future",
    *[Symbol.iterator]() {
      routine.next(halt_i);
      return yield* finalized;
    },
    then: (fn, ...args) => {
      routine.next(halt_i);
      if (fn) {
        return finalized.then(() => fn(), ...args);
      } else {
        return finalized.then(fn, ...args);
      }
    },
    catch: (...args) => finalized.catch(...args),
    finally: (...args) => finalized.catch(...args),
  } as Future<void>;
}
