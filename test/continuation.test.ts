import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";

import { Operation, evaluate, reset, shift } from "../mod.ts";

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

  // it("each continuation point function only resumes once", () => {
  //   let beginning, middle, end;
  //   let next = evaluate<Continuation<string, Continuation<number>>>(
  //     function* () {
  //       beginning = true;
  //       middle = yield* shift(function* (k) {
  //         return k;
  //       });
  //       end = yield* shift<number>(function* (k) {
  //         return k;
  //       });
  //       return end * 10;
  //     },
  //   );

  //   assertEquals(true, beginning);
  //   assertEquals(undefined, middle);

  //   let last = evaluate<(val: number) => Computation<number>>(() =>
  //     next("reached middle")
  //   );
  //   assertEquals("reached middle", middle);
  //   assertEquals(undefined, end);
  //   assertEquals("function", typeof last);

  //   let second = evaluate(() => next("continue"));
  //   assertEquals("reached middle", middle);
  //   assertEquals(undefined, end);
  //   assertEquals(void 0, second);

  //   let result = evaluate(() => last(10));
  //   assertEquals(10, end);
  //   assertEquals(100, result);

  //   let result2 = evaluate(() => last(100));
  //   assertEquals(10, end);
  //   assertEquals(undefined, result2);
  // });

  // it("each continuation point only fails once", () => {
  //   let bing = 0;
  //   let boom = evaluate<Continuation<void>>(function* () {
  //     yield* shift(function* (k) {
  //       return k;
  //     });
  //     throw new Error(`bing ${++bing}`);
  //   });

  //   assertThrows(() => evaluate(() => boom()), Error, "bing 1");
  //   assertEquals(undefined, evaluate(() => boom()));
  // });

  // it("returns the value of the following shift point when continuing ", () => {
  //   let { k } = evaluate<{ k: Continuation<unknown> }>(function* () {
  //     let k = yield* reset(function* () {
  //       let result = yield* shift<number>(function* (k) {
  //         return k;
  //       });

  //       return yield* shift(function* () {
  //         return result * 2;
  //       });
  //     });
  //     return { k };
  //   });
  //   assertEquals("function", typeof k);
  //   assertEquals(10, evaluate(() => k(5)));
  // });

  // it.ignore("can recurse to arbirtary depths without overflowing the call stack", () => {
  //   let result = evaluate(function* run() {
  //     let sum = 0;
  //     for (let i = 0; i < 100_000; i++) {
  //       sum += yield* shift<1, number>(function* incr(k) {
  //         return yield* k(1);
  //       });
  //     }
  //     return sum;
  //   });
  //   expect(result).toEqual(100_000);
  // });
});
