import { suspend } from "./suspend.ts";
import { spawn } from "./spawn.ts";
import { Operation } from "./types.ts";
import { controlBounds, useCoroutine } from "./coroutine.ts";
import { Do, Resume } from "./control.ts";
import { Ok } from "./result.ts";

export interface Provide<T> {
  (value: T): Operation<void>;
}

export function* resource<T>(
  op: (provide: Provide<T>) => Operation<void>,
): Operation<T> {
  let caller = yield* useCoroutine();

  function* provide(value: T): Operation<void> {
    caller.next(Resume(Ok(value)));
    yield* suspend();
  }

  // establishing a control boundary lets us catch errors in
  // resource initializer
  return yield* controlBounds<T>(function* () {
    yield* spawn(() => op(provide));

    return (yield Do(() => {}, "await resource")) as T;
  });
}
