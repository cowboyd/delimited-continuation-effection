import { constant } from "./constant.ts";
import { action } from "./action.ts";
import { Operation } from "./types.ts";

export interface Callable<
  T extends Operation<unknown> | Promise<unknown> | unknown,
  TArgs extends unknown[] = [],
> {
  (...args: TArgs): T;
}

export function call<T, TArgs extends unknown[] = []>(
  callable: Callable<T, TArgs>,
  ...args: TArgs
): Operation<T> {
  return {
    [Symbol.iterator]() {
      let target = callable.call(void (0), ...args);
      if (
        typeof target === "string" || Array.isArray(target) ||
        target instanceof Map || target instanceof Set
      ) {
        return constant(target)[Symbol.iterator]();
      } else if (isPromise<T>(target)) {
        return action<T>(function wait(resolve, reject) {
          target.then(resolve, reject);
          return () => {};
        })[Symbol.iterator]();
      } else if (isOperation<T>(target)) {
        return target[Symbol.iterator]();
      } else {
        return constant(target)[Symbol.iterator]();
      }
    },
  };
}
1;

function isPromise<T>(
  target: Operation<T> | Promise<T> | T,
): target is Promise<T> {
  return target && typeof (target as Promise<T>).then === "function";
}

function isOperation<T>(
  target: Operation<T> | Promise<T> | T,
): target is Operation<T> {
  return target &&
    typeof (target as Operation<T>)[Symbol.iterator] === "function";
}
