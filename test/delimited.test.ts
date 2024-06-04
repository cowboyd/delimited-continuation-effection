import { describe, expect, it } from "./suite.ts";
import { run, sleep, spawn, suspend } from "../mod.ts";
import { delimit } from "../delimited.ts";

describe("delimiter", () => {
  it("marks the boundaries of spawned tasks", async () => {
    let exits = {
      outer: false,
      inner: false,
    };
    await run(function* () {
      yield* spawn(function* () {
        try {
          yield* suspend();
        } finally {
          exits.outer = true;
        }
      });

      yield* delimit(function* () {
        yield* spawn(function* () {
          try {
            yield* suspend();
          } finally {
            exits.inner = true;
          }
        });
        yield* sleep(0);
      });
      expect(exits.inner).toEqual(true);
    });
    expect(exits.outer).toEqual(true);
  });
});
