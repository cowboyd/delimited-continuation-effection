import { useSelf } from "./coroutine.ts";
import type { Delimiter, Operation } from "./types.ts";

export function* delimit<T>(
  delimiter: Delimiter,
  op: () => Operation<T>,
): Operation<T> {
  let self = yield* useSelf();
  let { handlers: original } = self;
  let delimited = Object.create(original, {
    [delimiter.handler]: {
      value: delimiter,
    },
  });

  try {
    self.handlers = delimited;
    return yield* delimiter.delimit(op);
  } finally {
    self.handlers = original;
  }
}
