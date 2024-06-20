import { createCoroutine } from "./coroutine.ts";
import { Ok } from "./result.ts";
import type { Operation, Task } from "./types.ts";
import { withResolvers } from "./with-resolvers.ts";
import { lazyPromiseWithResolvers } from "./lazy-promise-with-resolvers.ts";
import { Reducer } from "./reduce.ts";
import { Resume } from "./control.ts";

export function run<T>(op: () => Operation<T>): Task<T> {
  let { reduce } = new Reducer();

  let operation = withResolvers<T>();
  let promise = lazyPromiseWithResolvers<T>("Task");
  
  let routine = createCoroutine<void>({
    *operation() {
      try {
	let result = yield* op();
	promise.resolve(result);
	operation.resolve(result);
      } catch (error) {
	promise.reject(error);
	operation.reject(error);	
      }
    },
    reduce,
    done() {}
  });

  routine.next(Resume(Ok()));

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
  
  return task;
}

