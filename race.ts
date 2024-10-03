import { spawn } from "./spawn.ts";
import { useScope } from "./scope.ts";
import { scoped } from "./scoped.ts";
import type { Operation, Yielded } from "./types.ts";
import { withResolvers } from "./with-resolvers.ts";
import { transfer } from "./scope.ts";
import { Err, Ok, Result } from "./result.ts";

export function* race<T extends Operation<unknown>>(
  operations: readonly T[],
): Operation<Yielded<T>> {
  let caller = yield* useScope();
  let winner = withResolvers<Result<Yielded<T>>>();

  // encapsulate the race in a hermetic scope.
  let result = yield* scoped(function* () {
    for (let operation of operations) {
      yield* spawn(function* () {
        let contestant = yield* useScope();
        try {
          let value = yield* operation;

          // Transfer the winner to the contestant
          transfer({ from: contestant, to: caller });
          winner.resolve(Ok(value as Yielded<T>));
        } catch (error) {
          winner.resolve(Err(error));
        }
      });
    }
    return yield* winner.operation;
  });

  if (result.ok) {
    return result.value;
  } else {
    throw result.error;
  }
}
