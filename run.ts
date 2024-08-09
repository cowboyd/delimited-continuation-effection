import { createTask } from "./task.ts";
import { Operation, Task } from "./types.ts";

export function run<T>(operation: () => Operation<T>): Task<T> {
  let [start, task] = createTask<T>({ operation });
  start();
  return task;
}
