import { Resume } from "./control.ts";
import { createCoroutine } from "./coroutine.ts";
import { lazyPromiseWithResolvers } from "./lazy-promise-with-resolvers.ts";
import { Ok } from "./result.ts";
import { Coroutine, Operation, Reject, Resolve } from "./types.ts";

export interface Delimiter<T, TReturn = T> {
  (
    routine: Coroutine,
    resume: (routine: Coroutine) => Operation<T>,
  ): Operation<TReturn>;
}

export function createTask<T>(op: () => Operation<T>): Promise<T> {
  let { resolve, reject, promise } = lazyPromiseWithResolvers<T>();

  let operation = (routine: Coroutine) =>
    delimitTask<T>(resolve, reject)(routine, op);

  let routine = createCoroutine({ operation });

  routine.next(Resume(Ok()));

  return promise;
}

function delimitTask<T>(
  resolve: Resolve<T>,
  reject: Reject,
): Delimiter<T, void> {
  return function* task(routine, resume) {
    try {
      resolve(yield* routine.with({}, resume));
    } catch (error) {
      reject(error);
    }
  };
}
