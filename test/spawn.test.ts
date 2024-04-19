import { describe, it } from "https://deno.land/std@0.223.0/testing/bdd.ts";
import { evaluate } from "../mod.ts";
import { spawn } from "../spawn.ts";
import { sleep } from "../sleep.ts";
import { expect } from "jsr:@std/expect";

describe("spawn", () => {
  it("creates haltable tasks", async () => {
    await new Promise<void>((resolve, reject) => {
      evaluate(function* () {
        try {
          let halted = false;
          let one = yield* spawn(function* () {
            try {
              yield* sleep(100);
            } finally {
              halted = true;
            }
          });

          expect(halted).toEqual(false);

          yield* sleep(10);

          yield* one;

          expect(halted).toEqual(true);

          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  });
});
