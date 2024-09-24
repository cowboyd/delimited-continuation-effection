import {
  Control,
  Done,
  Resume,
  Suspend,
  Do,
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
}

export function createCoroutine<T>(options: CoroutineOptions<T>): Coroutine<T> {
  let {
    operation,
    reduce = new Reducer().reduce,
    name = options.operation.name,
    context,
  } = options;

  let iterator: Iterator<Instruction, T, unknown> | undefined;

  let routine: Coroutine<T> = {
    name,
    stack: new DelimitedStack(),
    context: Object.create(context ?? null),
    handlers: controlHandlers() as Record<string, InstructionHandler>,
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
  return (yield Do((routine) => routine.next(Resume(Ok(routine))))) as Coroutine;
}

export function controlScope<T>(): Delimiter<T, T> {
  return function* control(routine, next) {
    try {
      yield Do(({ stack, next }) => next(Resume(Ok(stack.pushDelimiter()))));
      return yield* next(routine);
    } catch (error) {
      throw yield Do(({stack, next}) => next(Resume(Ok(stack.setDelimiterExitResult((Err(error)))))));
    } finally {
      yield Do(({ stack, next }) => next(Resume(stack.popDelimiter())));
    }
  };
}

function controlHandlers() {
  return {
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
        } else if (control.method === "do") {
	  control.fn(routine);	  
	}
      } catch (error) {
        routine.next(Done(Err(error)));
      }
    },
  } as const;
}
