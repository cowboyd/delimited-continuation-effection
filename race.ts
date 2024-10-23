import { spawn } from "./spawn.ts";
import { encapsulate, trap } from "./task.ts";
import type { Operation, Task, Yielded } from "./types.ts";
import { withResolvers } from "./with-resolvers.ts";
import { Err, Ok, Result } from "./result.ts";

//import { useScope } from "./scope.ts";
//import { transfer } from "./scope.ts";

export function* race<T extends Operation<unknown>>(
  operations: readonly T[],
): Operation<Yielded<T>> {
  //  let caller = yield* useScope();
  let winner = withResolvers<Result<Yielded<T>>>("await winner");

  let tasks: Task<unknown>[] = [];

  // encapsulate the race in a hermetic scope.
  let result = yield* trap(() =>
    encapsulate(function* () {
      for (let operation of operations.toReversed()) {
        tasks.push(
          yield* spawn(function* () {
            //          let contestant = yield* useScope();
            try {
              let value = yield* operation;

              // Transfer the winner to the contestant
              //        transfer({ from: contestant, to: caller });
              winner.resolve(Ok(value as Yielded<T>));
            } catch (error) {
              winner.resolve(Err(error));
            }
          }),
        );
      }
      return yield* winner.operation;
    })
  );

  let shutdown: Task<void>[] = [];

  for (let task of tasks) {
    shutdown.push(yield* spawn(task.halt));
  }

  for (let task of shutdown) {
    yield* task;
  }

  if (result.ok) {
    return result.value;
  } else {
    throw result.error;
  }
}
