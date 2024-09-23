import {
  Control,
  Done,
  Errormark,
  Popmark,
  Pushmark,
  Resume,
  Suspend,
} from "./control.ts";
import { DelimitedStack } from "./delimited-stack.ts";
import { Reducer } from "./reducer.ts";
import { Err, Ok, Result } from "./result.ts";
import type {
  Coroutine,
  Delimiter,
  Instruction,
  InstructionHandler,
  Operation,
} from "./types.ts";

export interface CoroutineOptions<T> {
  name?: string;
  operation(routine: Coroutine): Operation<T>;
  reduce?(routine: Coroutine, instruction: Instruction): void;
  context?: Record<string, unknown>;
  handlers?: { [name: string]: InstructionHandler };
}

export function createCoroutine<T>(options: CoroutineOptions<T>): Coroutine<T> {
  let {
    operation,
    reduce = new Reducer().reduce,
    name = options.operation.name,
    context,
    handlers,
  } = options;

  let iterator: Iterator<Instruction, T, unknown> | undefined;

  let routine: Coroutine<T> = {
    name,
    stack: new DelimitedStack(),
    context: Object.create(context ?? null),
    handlers: Object.assign(controlHandlers(), handlers),
    reduce,
    instructions() {
      if (!iterator) {
        iterator = operation(routine)[Symbol.iterator]();
      }
      return iterator;
    },
    next: (instruction) => reduce(routine, instruction),
  };

  return routine;
}

export function* useCoroutine(): Operation<Coroutine> {
  return (yield { handler: "@effection/self", data: {} }) as Coroutine;
}

export function controlScope<T>(): Delimiter<T, T> {
  return function* control(routine, next) {
    try {
      yield Pushmark();
      return yield* next(routine);
    } catch (error) {
      throw yield Errormark(error);
    } finally {
      yield Popmark();
    }
  };
}

function controlHandlers() {
  return {
    ["@effection/self"](routine: Coroutine) {
      routine.next(Resume(Ok(routine)));
    },
    ["@effection/coroutine"](routine: Coroutine, control: Control) {
      try {
        const iterator = routine.instructions();
        if (control.method === "resume") {
          let result = control.result;
          if (result.ok) {
            let next = iterator.next(result.value);
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
          routine.stack.setDelimiterExitResult(control.result);

          if (iterator.return) {
            let next = iterator.return();
            if (next.done) {
              routine.next(Done(Ok(next.value)));
            } else {
              routine.next(next.value);
            }
          } else {
            routine.next(Done(Ok()));
          }
        } else if (control.method === "suspend") {
          if (control.unsuspend) {
            let { unsuspend } = control;
            let settlement: Result<unknown> | void = void 0;
            let settle = (result: Result<unknown>) => {
              if (!settlement) {
                settlement = result;
                routine.next(Resume(settlement));
              }
            };
            let resolve = (value: unknown) => settle(Ok(value));
            let reject = (error: Error) => settle(Err(error));

            routine.next(Resume(Ok((function* suspend() {
              let exit = unsuspend(resolve, reject) ?? (() => {});
              try {
                return (yield Suspend()) as unknown;
              } finally {
                exit();
              }
            })())));
          }
        } else if (control.method === "pushmark") {
          routine.stack.pushDelimiter();
          routine.next(Resume(Ok()));
        } else if (control.method === "popmark") {
          let result = routine.stack.popDelimiter();
          routine.next(Resume(result));
        } else if (control.method === "errormark") {
          let result = routine.stack.setDelimiterExitResult(Err(control.error));
          routine.next(Resume(result));
        }
      } catch (error) {
        routine.next(Done(Err(error)));
      }
    },
  };
}
