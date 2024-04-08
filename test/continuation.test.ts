import { describe, it } from "jsr:@std/testing@0.221.0/bdd";
import { expect } from "jsr:@std/expect";

import { Continuation, evaluate, Operation, reset, shift } from "../mod.ts";

describe("continuation", () => {
  it("evaluates synchronous values synchronously", () => {
    expect(evaluate(function* () {
      return 5;
    })).toEqual(5);
  });

  it("evaluates synchronous shifts synchronously", () => {
    expect(evaluate(function* (): Operation<number> {
      return yield* shift(function* () {
        return 5;
      });
    })).toEqual(5);
  });

  it("can exit early from  recursion", () => {
    function* times([first, ...rest]: number[]): Operation<number> {
      if (first === 0) {
        return yield* shift(function* () {
          return 0;
        });
      } else if (first == null) {
        return 1;
      } else {
        return first * (yield* times(rest));
      }
    }

    expect(evaluate(() => times([8, 0, 5, 2, 3]))).toEqual(0);
    expect(evaluate(() => times([8, 1, 5, 2, 3]))).toEqual(240);
  });

  it("can invoke a continuation later", async () => {
  });

  it("returns the value of the following shift point when continuing ", () => {
    let num = evaluate(function* () {
      let k = yield* reset<Continuation<number, number>>(function* () {
        let result = yield* shift<number, number, Continuation<number, number>>(
          function* (k) {
            return k;
          },
        );

        return yield* shift(function* () {
          return result * 2;
        });
      });
      return yield* k(5);
    });
    expect(num).toEqual(10);
  });

  it("can recurse to arbirtary depths without overflowing the call stack", () => {
    let result = evaluate(function* run() {
      let sum = 0;
      for (let i = 0; i < 100_000; i++) {
        sum += yield* shift<1, number, number>(function* incr(k) {
          return yield* k(1);
        });
      }
      return sum;
    });
    expect(result).toEqual(100_000);
  });

  it("each continuation point function only resumes once", () => {
    let result = evaluate(function* () {
      let k = yield* reset<Continuation<void, number>>(function* () {
        yield* shift<number, unknown, unknown>(function* (k) {
          return k;
        });
        for (let i = 0;; i++) {
          yield* shift(function* () {
            return i;
          });
        }
      });
      yield* k();
      yield* k();
      yield* k();
      return yield* k();
    });
    expect(result).toEqual(0);
  });

  it("propagates errors in top-level evaluate", () => {
    expect(() =>
      evaluate(function* () {
        throw new Error("boom!");
      })
    ).toThrow("boom!");
  });

  it("allows catching of errors through multiple shift/reset boundaries", () => {
    let result = evaluate(function* () {
      try {
        return yield* reset(function* () {
          return yield* shift(function* () {
            throw new Error("boom!");
          });
        });
      } catch (error) {
        return error;
      }
    });

    expect(result).toMatchObject({
      message: "boom!",
    });
  });
});
