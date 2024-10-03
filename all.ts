import type { Operation, Scope, Task, Yielded } from "./types.ts";
import { transfer, useScope } from "./scope.ts";
import { scoped } from "./scoped.ts";
import { spawn } from "./spawn.ts";
import { withResolvers } from "./with-resolvers.ts";
import { race } from "./race.ts";

/**
 * Block and wait for all of the given operations to complete. Returns
 * an array of values that the given operations evaluated to. This has
 * the same purpose as
 * [Promise.all](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all).
 *
 * If any of the operations become errored, then `all` will also become errored.
 *
 * ### Example
 *
 * ``` javascript
 * import { all, expect, main } from 'effection';
 *
 * await main(function*() {
 *  let [google, bing] = yield* all([
 *    expect(fetch('http://google.com')),
 *    expect(fetch('http://bing.com')),
 *   ]);
 *  // ...
 * });
 * ```
 *
 * @param ops a list of operations to wait for
 * @returns the list of values that the operations evaluate to, in the order they were given
 */
export function* all<T extends readonly Operation<unknown>[] | []>(
  ops: T,
): Operation<All<T>> {
  let { operation: failure, reject: fail } = withResolvers<All<T>>();

  let evaluate = scoped(function* (): Operation<All<T>> {
    let tasks: Task<unknown>[] = [];

    for (let operation of ops) {
      tasks.push(
        yield* spawn(function* () {
          try {
            let value = yield* operation;
            return value;
          } catch (error) {
            fail(error);
          }
        }),
      );
    }
    let results = [];
    for (let task of tasks) {
      results.push(yield* task);
    }
    return results as All<T>;
  });

  return yield* race([failure, evaluate]);
}

/**
 * This type allows you to infer heterogenous operation types.
 * e.g. `all([sleep(0), expect(fetch("https://google.com")])`
 * will have a type of `Operation<[void, Request]>`
 */

type All<T extends readonly Operation<unknown>[] | []> = {
  -readonly [P in keyof T]: Yielded<T[P]>;
};
