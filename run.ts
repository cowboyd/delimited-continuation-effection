import { createScope } from "./scope.ts";
import { createTask } from "./task.ts";
import { Operation, Task } from "./types.ts";

export function run<T>(operation: () => Operation<T>): Task<T> {
  let [scope] = createScope();
  let [start, task] = createTask<T>({ operation, scope });
  start();
  return task;
}
