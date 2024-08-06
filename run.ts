import { createTask } from "./task.ts";
import { Operation, Task } from "./types.ts";

export function run<T>(op: () => Operation<T>): Task<T> {
  let task = createTask<T>(op);
  return task;
}
