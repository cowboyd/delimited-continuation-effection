import { resource } from "../mod.ts";
import { describe, expect, it } from "./suite.ts";
import {
  // createContext,
  // createScope,
  // resource,
  // run,
  // suspend,
  // useScope,
} from "../mod.ts";

describe("Scope", () => {
  it("can be used to run operations", async () => {
    // let [scope] = createScope();
    // let t1 = scope.run(function* () {
    //   return 1;
    // });
    // let t2 = scope.run(function* () {
    //   return 2;
    // });
    // expect(await t1).toEqual(1);
    // expect(await t2).toEqual(2);
  });

  //   it("succeeds on close if the frame has errored", async () => {
  //     let error = new Error("boom!");
  //     let [scope, close] = createScope();
  //     let bomb = scope.run(function* () {
  //       throw error;
  //     });
  //     await expect(bomb).rejects.toEqual(error);
  //     await expect(close()).resolves.toBeUndefined();
  //   });

  //   it("errors on close if there is an problem in teardown", async () => {
  //     let error = new Error("boom!");
  //     let [scope, close] = createScope();
  //     scope.run(function* () {
  //       try {
  //         yield* suspend();
  //       } finally {
  //         // deno-lint-ignore no-unsafe-finally
  //         throw error;
  //       }
  //     });
  //     await expect(close()).rejects.toEqual(error);
  //   });

  //   it("still closes open resources whenever something errors", async () => {
  //     let error = new Error("boom!");
  //     let [scope, close] = createScope();
  //     let tester: Tester = {};

  //     scope.run(function* () {
  //       yield* useTester(tester);
  //       yield* suspend();
  //     });

  //     scope.run(function* () {
  //       throw error;
  //     });
  //     await expect(close()).resolves.toBeUndefined();
  //     expect(tester.status).toEqual("closed");
  //   });

  //   it("let's you capture scope from an operation", async () => {
  //     let tester: Tester = {};
  //     await run(function* () {
  //       let scope = yield* useScope();
  //       scope.run(function* () {
  //         yield* useTester(tester);
  //         yield* suspend();
  //       });
  //       expect(tester.status).toEqual("open");
  //     });
  //     expect(tester.status).toEqual("closed");
  //   });

  //   it("has a separate context for each operation it runs", async () => {
  //     let cxt = createContext<number>("number");

  //     function* incr() {
  //       let value = yield* cxt;
  //       return yield* cxt.set(value + 1);
  //     }

  //     await run(function* () {
  //       let scope = yield* useScope();
  //       yield* cxt.set(1);

  //       let first = yield* scope.run(incr);
  //       let second = yield* scope.run(incr);
  //       let third = yield* scope.run(incr);

  //       expect(yield* cxt).toEqual(1);
  //       expect(first).toEqual(2);
  //       expect(second).toEqual(2);
  //       expect(third).toEqual(2);
  //     });
  //   });

  //   it("can get and set a context programatically", async () => {
  //     let context = createContext<string>("aString");
  //     let [scope] = createScope();
  //     expect(scope.get(context)).toEqual(void 0);
  //     expect(scope.set(context, "Hello World!")).toEqual("Hello World!");
  //     expect(scope.get(context)).toEqual("Hello World!");
  //     await expect(scope.run(() => context)).resolves.toEqual("Hello World!");
  //   });

  //   it("propagates uncaught errors within a scope", async () => {
  //     let error = new Error("boom");
  //     let result = run(function* () {
  //       let scope = yield* useScope();
  //       scope.run(function* () {
  //         throw error;
  //       });
  //       yield* suspend();
  //     });
  //     await expect(result).rejects.toBe(error);
  //   });

  //   it("throws an error if you try to run() with a dead scope", async () => {
  //     let scope = await run(useScope);

  //     expect(() => scope.run(function* () {})).toThrow("cannot call");
  //   });
});

interface Tester {
  status?: "open" | "closed";
}

const useTester = (state: Tester) =>
  resource<Tester>(function* (provide) {
    try {
      state.status = "open";
      yield* provide(state);
    } finally {
      state.status = "closed";
    }
  });
