import { Reducer } from "./mod.ts";
import type { Operation, Task } from "./types.ts";

export function run<T>(op: () => Operation<T>): Task<T> {
  let { promise, resolve, reject } = Promise.withResolvers<T>();
  let reducer = new Reducer();

  let routine = reducer.createRoutine("run", (function*() {
    try {
      let value = yield* op();
      resolve(value);
      return value;
    } catch (error) {
      reject(error);
      throw error;
    } finally {
      reject(new Error('halted'));
    }
  })());

  routine.start();

  return {
    [Symbol.toStringTag]: "Task",
    [Symbol.iterator]: () => routine.await()[Symbol.iterator](),
    then: (...args) => promise.then(...args),
    catch: (...args) => promise.catch(...args),
    finally: (...args) => promise.finally(...args),
    halt: () => routine.halt(),
  };
}
