import { describe, it } from "jsr:@std/testing@0.221.0/bdd";
import { expect } from "jsr:@std/expect";

import {
  Continuation,
  evaluate,
  type Operation,
  ReEnter,
  reset,
  shift,
} from "../bare.ts";

describe("continuation", () => {
  it("evaluates synchronous values synchronously", () => {
    expect(evaluate(function* () {
      return 5;
    })).toEqual(5);
  });

  it("evaluates synchronous shifts synchronously", () => {
    expect(evaluate(function* (): Operation<number> {
      return yield shift(function* () {
        return 5;
      });
    })).toEqual(5);
  });

  // it.ignore("can invoke a continuation immediately", () => {
  //   expect(evaluate(function* () {
  //     return yield reset(function* () {
  //       yield shift<void, number, number>(function* (k) {
  //         return 2 * (yield* k());
  //       });
  //       return 5;
  //     });
  //   })).toEqual(5);
  // });

  it("can exit early from  recursion", () => {
    function* times([first, ...rest]: number[]): Operation<number> {
      if (first === 0) {
        return yield shift(function* () {
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

  it("returns the value of the following shift point when continuing ", () => {
    let num = evaluate(function* () {
      let k: Continuation<number> = yield reset(function* () {
        let result = (yield shift(
          function* (k) {
            return k;
          },
        )) as number;
        yield shift(function* () {
          return result * 2;
        });
      });
      return yield k(5);
    });
    expect(num).toEqual(10);
  });

  it("can recurse to arbirtary depths without overflowing the call stack", () => {
    let result = evaluate(function* run() {
      let sum = 0;
      for (let i = 0; i < 10_000; i++) {
        sum += yield shift(function* incr(k) {
          return yield k(1);
        });
      }
      return sum;
    });
    expect(result).toEqual(10_000);
  });

  it("each continuation point function only resumes once", () => {
    let result = evaluate(function* () {
      let k: Continuation<void> = yield reset(function* () {
        yield shift(function* (k) {
          return k;
        });
        for (let i = 0;; i++) {
          yield shift(function* () {
            return i;
          });
        }
      });
      yield k();
      yield k();
      yield k();
      return yield k();
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
        return yield reset(function* () {
          return yield shift(function* () {
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

  it("tears down subroutines before returning", () => {
    let teardown: string[] = [];
    evaluate(function* () {
      yield reset(function* () {
        try {
          yield shift(function* () {});
        } finally {
          teardown.push("one");
        }
      });
      yield reset(function* () {
        try {
          yield shift(function* () {});
        } finally {
          teardown.push("two");
        }
      });
    });
    expect(teardown).toEqual(["two", "one"]);
  });

  it("fails if an error occurs in teardown rather than return a value", () => {
    expect(() =>
      evaluate(function* () {
        yield reset(function* () {
          try {
            yield shift(function* () {});
          } finally {
            // deno-lint-ignore no-unsafe-finally
            throw new Error("boom!");
          }
        });
      })
    ).toThrow("boom!");
  });

  it("executes all teardown it can even if the result will be an error", () => {
    let teardown = "skipped";
    expect(() =>
      evaluate(function* () {
        yield reset(function* () {
          try {
            yield shift(function* () {});
          } finally {
            teardown = "completed";
          }
        });
        yield reset(function* () {
          try {
            yield shift(function* () {});
          } finally {
            // deno-lint-ignore no-unsafe-finally
            throw new Error("boom!");
          }
        });
      })
    ).toThrow("boom!");
    expect(teardown).toEqual("completed");
  });

  it("can be re-entered from external code", () => {
    let result = "nothing";
    let { k, reenter } = evaluate(function* () {
      result = yield shift(function* (k, reenter) {
        return { reenter, k };
      });
    }) as { k: Continuation<string>; reenter: ReEnter<string> };
    reenter(k, "hello");
    expect(result).toEqual("hello");
  });

  it("can re-enter from within a reducing stack", () => {
    let result = "nothing";
    evaluate(function* () {
      result = yield shift(function* (k, reenter) {
        reenter(k, "hello");
      });
    });

    expect(result).toEqual("hello");
  });
});
