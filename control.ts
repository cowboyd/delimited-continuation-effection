import { Err, Ok, Result } from "./result.ts";
import { Delimiter, Instruction, Operation, Reject, Resolve } from "./types.ts";

export function Done<T>(result: Result<T>): Instruction {
  return {
    handler: "@effection/coroutine",
    data: { method: "done", result },
  };
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

export interface Unsuspend<T> {
  (resolve: Resolve<T>, reject: Reject): () => void;
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
} | {
  method: "done";
  result: Result<unknown>;
};

export interface ControlOptions<T> {
  operation(): Operation<T>;
  done(value: Result<T>): void;
}

export function createControlDelimiter<T>(options: ControlOptions<T>): Delimiter<Control> {
  let iterator: Iterator<Instruction, T, unknown> | undefined = undefined;
  let instructions = () => {
    if (!iterator) {
      iterator = options.operation()[Symbol.iterator]();
    }
    return iterator;
  }
  
  let exit = Ok();

  return {
    handler: "@effection/coroutine",
    handle(control, routine) {
      try {
        let iterator = instructions();
        if (control.method === "self") {
          routine.next(Resume(Ok(routine)));
        } else if (control.method === "resume") {
          let result = control.result;
          if (result.ok) {
            let next = instructions().next(result.value);
            if (next.done) {
              routine.next(Done(Ok(next.value)));
            } else {
              routine.next(next.value);
            }
          } else if (iterator.throw) {
	    let next = iterator.throw(result.error);
	    if (next.done) {
	      routine.next(Done(Ok(next.value)));
	    } else {
	      routine.next(next.value);
	    }
	  } else {
	    throw result.error;
	  }
        } else if (control.method === "break") {
          if (!control.result.ok) {
            exit = control.result;
          }
          if (iterator.return) {
            let next = iterator.return();
            if (next.done) {
              routine.next(Done(Ok()));
            } else {
              routine.next(next.value);
            }
          } else {
            routine.next(Done(Ok()));
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
        } else if (control.method === "done") {
	  options.done(control.result as Result<T>);
	}
      } catch (error) {
        routine.next(Done(Err(error)));
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
