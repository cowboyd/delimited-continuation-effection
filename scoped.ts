import { contextScope } from "./context.ts";
import { controlScope } from "./coroutine.ts";
import { delimit } from "./delimiter.ts";
import { spawnScope } from "./task.ts";
import { Operation } from "./types.ts";

export function scoped<T>(op: () => Operation<T>): Operation<T> {
  //@ts-expect-error I don't get it.
  return delimit([contextScope(), controlScope(), spawnScope()], op);
}
