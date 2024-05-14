import { reset, shift } from "./continuation.ts";
import type { Operation } from "./types.ts";

export type Provide<T> = (value: T) => Operation<void>;

export function resource<T>(
  body: (provide: (value: T) => Operation<void>) => Operation<void>,
): Operation<T> {
  return reset(function* () {
    yield* shift(function* () {
      return yield* shift(function* provide() {
        yield* body(provide);
      });
    });
  });
}
