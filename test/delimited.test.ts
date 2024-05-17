import { describe, expect, it } from "./suite.ts";
import { run, spawn, suspend } from "../mod.ts";
import { delimited } from "../delimited.ts";

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

      yield* delimited(function* () {
        yield* spawn(function* () {
          try {
            yield* suspend();
          } finally {
            exits.inner = true;
          }
        });
      });

      expect(exits.inner).toEqual(true);
    });
    expect(exits.outer).toEqual(true);
  });
});
