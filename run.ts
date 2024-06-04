import { createCoroutine, Resume } from "./coroutine.ts";
import { Maybe } from "./maybe.ts";
import { Ok } from "./result.ts";
import type { Delimiter, Instruction, Operation, Task } from "./types.ts";
import { withResolvers } from "./with-resolvers.ts";
import { lazyPromiseWithResolvers } from "./lazy-promise-with-resolvers.ts";
import { Reducer } from "./reduce.ts";

function createTaskDelimiter<T>(): [Delimiter<Maybe<T>>, Task<T>] {
  let operation = withResolvers<T>();
  let promise = lazyPromiseWithResolvers<T>("Task");

  let delimiter = {
    handler: "@effection/done",
    handle(outcome) {
      if (outcome.type === "just") {
        let { result } = outcome;
        if (result.ok) {
          promise.resolve(result.value);
          operation.resolve(result.value);
        } else {
          promise.reject(result.error);
          operation.reject(result.error);
        }
      } else if (outcome.type === "none") {
        let error = new Error("halted");
        promise.reject(error);
        operation.reject(error);
      }
    },
    delimit: (op) => op(),
  } as Delimiter<Maybe<T>>;

  let task = Object.create(promise.promise, {
    [Symbol.iterator]: {
      enumerable: false,
      value: operation.operation[Symbol.iterator],
    },
    halt: {
      enumerable: false,
      value: () => ({
        *[Symbol.iterator]() {
        },
      }),
    },
  });
  return [delimiter, task];
}

export function run<T>(op: () => Operation<T>): Task<T> {
  let reducer = new Reducer();
  let [withTask, task] = createTaskDelimiter<T>();

  let routine = createCoroutine({
    instructions: iterate(op),
    reduce: reducer.reduce,
  });

  routine.handlers[withTask.handler] = withTask;

  routine.next(Resume(Ok()));

  return task;
}

function iterate<T>(op: () => Operation<T>): Iterator<Instruction, T, unknown> {
  let actual: ReturnType<typeof iterate<T>> | undefined = void 0;
  let iterator: ReturnType<typeof iterate<T>> = {
    next(value) {
      if (!actual) {
        actual = op()[Symbol.iterator]();
        iterator.next = (...args: Parameters<typeof iterator.next>) =>
          actual!.next(...args);
      }
      return iterator.next(value);
    },
  };
  return iterator;
}
