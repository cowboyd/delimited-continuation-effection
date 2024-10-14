import { call } from "../call.ts";
import { log } from "../log.ts";
import { lift, race, run } from "../mod.ts";
import { withResolvers } from "../with-resolvers.ts";
import { describe, expect, it } from "./suite.ts";

describe("lift", () => {
  it.only("safely does not continue if the call stops the operation", async () => {
    let reached = false;

    await run(function* main() {
      let resolvers = withResolvers<void>();

      yield* race([
        resolvers.operation,
        call(function* loser() {
          yield* log("in loser");
          yield* lift(resolvers.resolve)();
          reached = true;
        }),
      ]);
    });

    expect(reached).toEqual(false);
  });
});
