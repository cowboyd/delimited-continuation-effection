import { blowUp, describe, expect, it } from "./suite.ts";
import { run, spawn, suspend } from "../mod.ts";
import { delimited } from "../delimited.ts";
import { withResolvers } from "../with-resolvers.ts";

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

  it("cannot catch spawned errors if not present", async () => {
    let task = run(function* () {
      yield* spawn(blowUp);

      try {
        yield* suspend();
      } catch (error) {
        return error;
      }
    });
    await expect(task).rejects.toHaveProperty("message", "boom");
  });

  it("allows for catching errors from spawned tasks", async () => {
    let task = run(function* () {
      try {
        yield* delimited(function* () {
          yield* spawn(blowUp);
          yield* suspend();
        });
      } catch (error) {
        return error;
      }
    });

    await expect(task).resolves.toHaveProperty("message", "boom");
  });
});
