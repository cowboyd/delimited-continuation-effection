import type { Delimiter, Operation } from "./types.ts";

export function* delimited<T>(op: () => Operation<T>): Operation<T> {
  let delimiter = (yield { type: "pushdelimiter" }) as Delimiter;
  try {
    return yield* op();
  } finally {
    yield* delimiter.drop();
    yield { type: "popdelimiter" };
  }
}
