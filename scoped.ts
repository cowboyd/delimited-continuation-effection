import { contextBounds } from "./context.ts";
import { controlBounds } from "./coroutine.ts";
import { taskBounds } from "./task.ts";
import { Operation } from "./types.ts";

export function scoped<T>(op: () => Operation<T>): Operation<T> {
  return contextBounds<T>(() => controlBounds<T>(() => taskBounds<T>(op)));
}
