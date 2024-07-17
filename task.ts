import { Break, Resume } from "./control.ts";
import { createCoroutine } from "./coroutine.ts";
import { createFutureWithResolvers, FutureWithResolvers } from "./future.ts";
import { Ok } from "./result.ts";
import { Coroutine, Future, Operation, Task } from "./types.ts";

export interface Delimiter<T, TReturn = T> {
  (
    routine: Coroutine,
    resume: (routine: Coroutine) => Operation<T>,
  ): Operation<TReturn>;
}

export function createTask<T>(op: () => Operation<T>): Task<T> {
  let result = createFutureWithResolvers<T>();
  let finalized = createFutureWithResolvers<void>();

  let operation = (routine: Coroutine) =>
    delimitTask(result, finalized)(routine, op);

  let routine = createCoroutine({ operation });

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

function delimitTask<T>(
  result: FutureWithResolvers<T>,
  finalized: FutureWithResolvers<void>,
): Delimiter<T, void> {
  return function* task(routine, resume) {
    try {
      result.resolve(yield* routine.with({}, resume));
    } catch (error) {
      result.reject(error);
      finalized.reject(error);
    } finally {
      finalized.resolve();
      result.reject(new Error("halted"));
    }
  };
}

function createHalt(
  routine: Coroutine,
  finalized: Future<void>,
): Future<void> {
  let interrupt = () => {
    interrupt = () => {};
    routine.next(Break(Ok()));
  };

  return {
    [Symbol.toStringTag]: "Future",
    *[Symbol.iterator]() {
      interrupt();
      return yield* finalized;
    },
    then: (fn, ...args) => {
      interrupt();
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
