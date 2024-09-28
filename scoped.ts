import { contextBounds } from "./scope.ts";
import { controlBounds } from "./coroutine.ts";
import { Operation } from "./types.ts";
import { TaskGroup } from "./task-group.ts";

export function scoped<T>(op: () => Operation<T>): Operation<T> {
  return contextBounds<T>(() =>
    controlBounds<T>(() => TaskGroup.encapsulate(op))
  );
}
