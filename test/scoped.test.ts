import { describe, expect, it } from "./suite.ts";
import { run, sleep, spawn, suspend } from "../mod.ts";
import { scoped } from "../scoped.ts";

describe("scoped()", () => {
  it("can catch an error spawned inside of an scoped", async () => {
    let error = new Error("boom!");
    let value = await run(function* main() {
      try {
        yield* scoped(function* () {
          yield* spawn(function* TheBomb() {
            yield* sleep(1);
            throw error;
          });
          yield* suspend();
        });
      } catch (err) {
        return err;
      }
    });
    expect(value).toBe(error);
  });
  
  it("does not let tasks escape", async () => {
    await run(function* main() {
      let halted = false;

      yield* scoped(function*() {
	yield* spawn(function*() {
	  try {
	    yield* suspend();
	  } finally {
	    halted = true;
	  }
	});
	yield* sleep(0);
      });

      expect(halted).toBe(true);
    })
  });
});
