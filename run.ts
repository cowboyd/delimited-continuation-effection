import { Reducer } from "./mod.ts";
import type { Operation, Task } from "./types.ts";

export function run<T>(op: () => Operation<T>): Task<T> {
  let reducer = new Reducer();
  return reducer.run(op);
}
