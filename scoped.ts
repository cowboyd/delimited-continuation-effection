import { contextBounds } from "./scope.ts";
import { controlBounds } from "./coroutine.ts";
import { Operation } from "./types.ts";

export function scoped<T>(op: () => Operation<T>): Operation<T> {
  return contextBounds<T>(() => controlBounds<T>(op));
}
