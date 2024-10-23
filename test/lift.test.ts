import { lift, run } from "../mod.ts";
import { withResolvers } from "../with-resolvers.ts";
import { spawn } from "../spawn.ts";
import { describe, expect, it } from "./suite.ts";

describe("lift", () => {
  it("safely does not continue if the call stops the operation", async () => {
    let reached = false;

    await run(function* main() {
      let resolvers = withResolvers<string>();
      yield* spawn(function* lifter() {
        yield* lift(resolvers.resolve)("resolve it!");
        reached = true;
      });

      yield* resolvers.operation;
    });

    expect(reached).toEqual(false);
  });
});
