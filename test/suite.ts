import { action, Operation } from "../mod.ts";
import { sleep } from "../sleep.ts";

export { describe, it } from "https://deno.land/std@0.223.0/testing/bdd.ts";
export { expect } from "jsr:@std/expect";
export { expectType } from "npm:ts-expect@1.3.0";

export function* createNumber(value: number): Operation<number> {
  yield* sleep(1);
  return value;
}

export function* blowUp<T>(): Operation<T> {
  yield* sleep(1);
  throw new Error("boom");
}

declare global {
  interface Promise<T> extends Operation<T> {}
}

Object.defineProperty(Promise.prototype, Symbol.iterator, {
  get<T>(this: Promise<T>) {
    let suspense = action<T>((resolve, reject) => {
      this.then(resolve, reject);
      return () => {};
    });
    return suspense[Symbol.iterator];
  },
});

export function* asyncResolve(
  duration: number,
  value: string,
): Operation<string> {
  yield* sleep(duration);
  return value;
}

export function* asyncReject(
  duration: number,
  value: string,
): Operation<string> {
  yield* sleep(duration);
  throw new Error(`boom: ${value}`);
}

export function* syncResolve(value: string): Operation<string> {
  return value;
}

export function* syncReject(value: string): Operation<string> {
  throw new Error(`boom: ${value}`);
}
