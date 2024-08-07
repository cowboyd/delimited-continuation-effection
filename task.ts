import { Break, Resume } from "./control.ts";
import { createCoroutine, delimitControl } from "./coroutine.ts";
import { createFutureWithResolvers, FutureWithResolvers } from "./future.ts";
import { Err, Ok } from "./result.ts";
import { Delimiter, Instruction } from "./types.ts";
import { Coroutine, Future, Operation, Task } from "./types.ts";

export function createTask<T>(operation: () => Operation<T>): Task<T> {
  let result = createFutureWithResolvers<T>();
  let finalized = createFutureWithResolvers<void>();

  let delimiters = [
    delimitTask(result, finalized),
    delimitControl(),
    delimitSpawn(),
  ];

  let routine = createCoroutine({ operation, delimiters });

  routine.next(Resume(Ok()));

  let halted: Future<void> | undefined = void 0;

  let halt = () => halted ? halted : createHalt(routine, finalized.future);

  return Object.create(result.future, {
    [Symbol.toStringTag]: {
      enumerable: false,
      value: "Task",
    },
    halt: {
      enumerable: false,
      value: halt,
    },
  });
}

function delimitSpawn<T>(): Delimiter<T, T, () => Operation<unknown>> {
  let children = new Set<Task<unknown>>();
  return {
    handlers: {
      ["@effection/task.spawn"]<T>(
        routine: Coroutine,
        op: () => Operation<T>,
      ) {
        let task = createTask(function* () {
          try {
            return yield* op();
          } catch (error) {
            routine.next(Break(Err(error)));
            throw error;
          } finally {
            if (typeof task !== "undefined") {
              children.delete(task);
            }
          }
        });
        children.add(task);
        routine.next(Resume(Ok(task)));
      },
    },
    delimit: function* spawnScope(routine, next) {
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
            }
          }
        }
        if (!teardown.ok) {
          throw teardown.error;
        }
      }
    },
  };
}

function delimitTask<T>(
  result: FutureWithResolvers<T>,
  finalized: FutureWithResolvers<void>,
): Delimiter<T, void, () => Operation<unknown>> {
  let state = { halted: false };

  return {
    delimit: function* task(routine, resume) {
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
    },
    handlers: {
      ["@effection/task.halt"](routine: Coroutine) {
        if (!state.halted) {
          state.halted = true;
          routine.next(Break(Ok()));
        }
      },
    },
  };
}

function Halt(): Instruction<void> {
  return { handler: "@effection/task.halt" } as Instruction<void>;
}

function createHalt(
  routine: Coroutine,
  finalized: Future<void>,
): Future<void> {
  return {
    [Symbol.toStringTag]: "Future",
    *[Symbol.iterator]() {
      routine.next(Halt());
      return yield* finalized;
    },
    then: (fn, ...args) => {
      routine.next(Halt());
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
