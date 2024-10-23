import { Operation, Task } from "./types.ts";

import { global } from "./scope.ts";

export function run<T>(operation: () => Operation<T>): Task<T> {
  return global.run(operation);
}
