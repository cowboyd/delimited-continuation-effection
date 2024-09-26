import { suspend } from "./suspend.ts";
import { spawn } from "./spawn.ts";
import { Operation } from "./types.ts";
import { controlScope, useCoroutine } from "./coroutine.ts";
import { delimit } from "./delimiter.ts";
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

  // by delimiting control scope here, this allows us to catch errors in resource initialization
  return yield* delimit([controlScope()], function* () {
    yield* spawn(function* () { // <- this is the resource task
      yield* op(provide);
    });

    let value = yield Do(() => {});
    return value as T;
  });

  // once the resource has called provide(value), and we leave the control delimitation
  // a resource failure will crash (up to the next control point)
}
