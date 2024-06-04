import { Just, Maybe, None } from "./maybe.ts";
import { Err, Ok, Result } from "./result.ts";
import type {
  Coroutine,
  Delimiter,
  Instruction,
  Operation,
  Unsuspend,
} from "./types.ts";

export interface Reduce {
  (routine: Coroutine, instruction: Instruction): void;
}

export interface CoroutineOptions<T> {
  instructions: Iterator<Instruction, T, unknown>;
  reduce: Reduce;
  parent?: Record<string, Delimiter>;
}

export function useSelf(): Operation<Coroutine> {
  return {
    *[Symbol.iterator]() {
      return (yield Self()) as Coroutine;
    },
  };
}

export function createCoroutine<T>(options: CoroutineOptions<T>): Coroutine<T> {
  let parent = options.parent ?? {
    "@effection/coroutine": createControlDelimiter(),
  };

  let handlers = Object.create(parent);

  let { instructions, reduce } = options;
  let routine: Coroutine<T> = {
    handlers,
    instructions,
    next: (instruction) => reduce(routine, instruction),
  };
  return routine;
}

export function Done(data: Maybe<unknown>): Instruction<Maybe<unknown>> {
  return { handler: "@effection/done", data };
}

export function Resume<T>(result: Result<T>): Instruction {
  return {
    handler: "@effection/coroutine",
    data: { method: "resume", result },
  };
}

export function Break<T>(result: Result<T>): Instruction {
  return { handler: "@effection/coroutine", data: { method: "break", result } };
}

export function Self(): Instruction<Control> {
  return { handler: "@effection/coroutine", data: { method: "self" } };
}

export function Suspend(unsuspend?: Unsuspend<unknown>): Instruction<Control> {
  return {
    handler: "@effection/coroutine",
    data: { method: "suspend", unsuspend },
  };
}

export type Control = {
  method: "resume";
  result: Result<unknown>;
} | {
  method: "break";
  result: Result<void>;
} | {
  method: "self";
} | {
  method: "suspend";
  unsuspend?: Unsuspend<unknown>;
};

export function createControlDelimiter(): Delimiter<Control> {
  let exit = Ok();

  return {
    handler: "@effection/coroutine",
    handle(control, routine) {
      try {
        if (control.method === "self") {
          routine.next(Resume(Ok(routine)));
        } else if (control.method === "resume") {
          let result = control.result;
          if (result.ok) {
            let next = routine.instructions.next(result.value);
            if (next.done) {
              routine.next(Done(Just(Ok(next.value))));
            } else {
              routine.next(next.value);
            }
          }
        } else if (control.method === "break") {
          if (!control.result.ok) {
            exit = control.result;
          }
          if (routine.instructions.return) {
            let next = routine.instructions.return();
            if (next.done) {
              routine.next(Done(None()));
            } else {
              routine.next(next.value);
            }
          } else {
            routine.next(Done(None()));
          }
        } else if (control.method === "suspend") {
          let teardown: () => void;
          if (control.unsuspend) {
            let settled = false;
            let settle = (result: Result<unknown>) => {
              if (!settled) {
                teardown();
                routine.next(Resume(result));
              }
            };
            let resolve = (value: unknown) => settle(Ok(value));
            let reject = (error: Error) => settle(Err(error));
            teardown = control.unsuspend(resolve, reject) ?? (() => {});
          }
        }
      } catch (error) {
        routine.next(Done(Just(Err(error))));
      }
    },
    *delimit(op) {
      try {
        return yield* op();
      } finally {
        if (!exit.ok) {
          // deno-lint-ignore no-unsafe-finally
          throw exit.error;
        }
      }
    },
  };
}
