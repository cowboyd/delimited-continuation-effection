import type { Operation } from "./types.ts";

export function* delimited<T>(op: () => Operation<T>): Operation<T> {
  yield { type: "pushdelimiter" };
  try {
    return yield* op();
  } finally {
    yield { type: "popdelimiter" };
  }
}
