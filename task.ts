import { createContext } from "./context.ts";
import { Break, Do, Instruction, Resume } from "./control.ts";
import { controlScope, createCoroutine } from "./coroutine.ts";
import { compose } from "./delimiter.ts";
import { createFutureWithResolvers, FutureWithResolvers } from "./future.ts";
import { Err, Ok } from "./result.ts";
import { Delimiter } from "./types.ts";
import { Coroutine, Future, Operation, Task } from "./types.ts";

export interface TaskOptions<T> {
  operation(): Operation<T>;
  reduce?(routine: Coroutine, instruction: Instruction): void;
  context?: Record<string, unknown>;
}

export function createTask<T>(options: TaskOptions<T>): [() => void, Task<T>] {
  let { reduce, context, operation: { name } } = options;
  let result = createFutureWithResolvers<T>();
  let finalized = createFutureWithResolvers<void>();

  let state = { halted: false };

  let delimit = compose([
    delimitTask(state, result, finalized),
    controlScope(),
    spawnScope(),
  ]);

  let operation = (routine: Coroutine) => delimit(routine, options.operation);

  let routine = createCoroutine({ name, operation, reduce, context });

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

const Children = createContext<Set<Task<unknown>>>("@effection/task.children");

export function spawnScope<T>(): Delimiter<T, T> {
  return function* spawnScope(routine, next) {
    let children = yield* Children.set(new Set());
    try {
      return yield* next(routine);
    } finally {
      let teardown = Ok();
      while (children.size > 0) {
        for (let child of [...children].reverse()) {
          try {
            yield* child.halt();
          } catch (error) {
            teardown = Err(error);
          } finally {
            children.delete(child);
          }
        }
      }
      if (!teardown.ok) {
        throw teardown.error;
      }
    }
  };
}

function delimitTask<T>(
  state: { halted: boolean },
  result: FutureWithResolvers<T>,
  finalized: FutureWithResolvers<void>,
): Delimiter<T, void> {
  return function* task(routine, resume) {
    try {
      let value = yield* resume(routine);

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
  };
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
