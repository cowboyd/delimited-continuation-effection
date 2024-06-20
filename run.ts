import { createCoroutine } from "./coroutine.ts";
import { Ok, Result } from "./result.ts";
import { Just, Maybe, None } from "./maybe.ts";
import type { Coroutine, Future, Operation, Task } from "./types.ts";
import { Reduce, Reducer } from "./reduce.ts";
import { Break, Resume } from "./control.ts";
import { createFutureWithResolvers } from "./future.ts";
import { lazyPromiseWithResolvers } from "./lazy-promise-with-resolvers.ts";
import { delimit } from "./delimited.ts";
import { spawnScope } from "./spawn.ts";

export function run<T>(operation: () => Operation<T>): Task<T> {
  let { reduce } = new Reducer();
  let [task, routine] = createTask({ operation, reduce });
  reduce(routine, Resume(Ok()));
  return task;
}

export interface CreateTaskOptions<T> {
  operation(): Operation<T>;
  reduce: Reduce;
  done?(task: Task<T>, result: Result<T>): void;
}

export function createTask<T>(
  options: CreateTaskOptions<T>,
): [Task<T>, Coroutine] {
  let { operation, reduce, done = () => {} } = options;
  let halt: Future<void> | undefined = undefined;

  let value = createFutureWithResolvers<Maybe<T>>();

  let routine = createCoroutine<T>({
    operation: () => delimit(spawnScope(), operation),
    reduce,
    done(result) {
      let outcome = !result.ok || !halt ? Just(result) : None<T>();
      value.resolve(outcome);
      done(task, result);
    },
  });

  let promise = lazyPromiseWithResolvers<T>();

  let task = {
    [Symbol.toStringTag]: "Task",
    *[Symbol.iterator]() {
      let outcome = yield* value.future;
      if (outcome.type === "none") {
        throw new Error("halted");
      } else {
        if (outcome.result.ok) {
          return outcome.result.value;
        } else {
          throw outcome.result.error;
        }
      }
    },
    then(...args) {
      value.future.then((outcome) => {
        if (outcome.type === "none") {
          promise.reject(new Error("halted"));
        } else {
          if (outcome.result.ok) {
            promise.resolve(outcome.result.value);
          } else {
            promise.reject(outcome.result.error);
          }
        }
      });
      return promise.promise.then(...args);
    },
    catch: (...args) => promise.promise.catch(...args),
    finally: (...args) => promise.promise.finally(...args),
    halt: () => halt ? halt : halt = createHalt(routine, value.future, reduce),
  } satisfies Task<T>;

  return [task = Object.create(task), routine];
}

function createHalt(
  routine: Coroutine,
  value: Future<Maybe<unknown>>,
  reduce: Reduce,
): Future<void> {
  let interrupt = () => {
    interrupt = () => {};
    reduce(routine, Break(Ok()));
  };

  return {
    [Symbol.toStringTag]: "Future",
    *[Symbol.iterator]() {
      interrupt();
      yield* value;
    },
    then: (fn, ...args) => {
      interrupt();
      if (fn) {
        return value.then(() => fn(), ...args);
      } else {
        return value.then(fn, ...args);
      }
    },
    catch: (...args) => value.catch(...args),
    finally: (...args) => value.catch(...args),
  } as Future<void>;
}
