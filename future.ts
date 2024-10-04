import { lazyPromiseWithResolvers } from "./lazy-promise-with-resolvers.ts";
import { Future, Reject, Resolve } from "./types.ts";
import { withResolvers } from "./with-resolvers.ts";

export interface FutureWithResolvers<T> {
  future: Future<T>;
  resolve: Resolve<T>;
  reject: Reject;
}

export function createFutureWithResolvers<T>(): FutureWithResolvers<T> {
  let operation = withResolvers<T>();
  let promise = lazyPromiseWithResolvers<T>("Future");

  let future = Object.create(promise.promise, {
    [Symbol.iterator]: {
      enumerable: false,
      value: operation.operation[Symbol.iterator],
    },
  });

  return {
    future,
    resolve(value) {
      promise.resolve(value);
      operation.resolve(value);
    },
    reject(error) {
      promise.reject(error);
      operation.reject(error);
    },
  };
}

export function doAndWait<T>(also: () => void, future: Future<T>): Future<T> {
  return {
    [Symbol.toStringTag]: "Future",
    *[Symbol.iterator]() {
      also();
      return yield* future;
    },
    then: (fn, ...args) => {
      also();
      if (fn) {
        return future.then((...x) => fn(...x), ...args);
      } else {
        return future.then(fn, ...args);
      }
    },
    catch: (...args) => future.catch(...args),
    finally: (...args) => future.catch(...args),
  } as Future<T>;
}
