import { action, Operation, resource, spawn } from "../mod.ts";
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
    let promise = this;
    let suspense = action<T>(function wait(resolve, reject) {
      promise.then(resolve, reject);
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

export function asyncResource(
  duration: number,
  value: string,
  status: { status: string },
): Operation<string> {
  return resource(function* AsyncResource(provide) {
    yield* spawn(function* () {
      yield* sleep(duration + 10);
      status.status = "active";
    });
    yield* sleep(duration);
    yield* provide(value);
  });
}

export function* syncResolve(value: string): Operation<string> {
  return value;
}

export function* syncReject(value: string): Operation<string> {
  throw new Error(`boom: ${value}`);
}
