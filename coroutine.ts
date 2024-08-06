// deno-lint-ignore-file no-unsafe-finally
import { Control, Done, Resume } from "./control.ts";
import { Err, Ok, Result } from "./result.ts";
import type { Coroutine, Delimiter, Instruction, Operation } from "./types.ts";

export interface CoroutineOptions<T> {
  name?: string;
  operation(routine: Coroutine): Operation<T>;
  reducer?: Reducer;
  delimiters: Delimiter<T, T, any>[];
}

export function createCoroutine<T>(options: CoroutineOptions<T>): Coroutine<T> {
  let {
    operation,
    reducer = new Reducer(),
    name = options.operation.name,
    delimiters,
  } = options;

  let iterator: Iterator<Instruction, T, unknown> | undefined;  

  let handlers = Object.assign(
    Object.create(null),
    ...delimiters.map((d) => d.handlers),
  );

  let delimit = options.delimiters.reduceRight((delimit, current) => {
    return (routine, next) => current.delimit(routine, (routine) => delimit(routine, next));
  }, (routine: Coroutine, next: (routine: Coroutine) => Operation<T>) => next(routine));


  let routine: Coroutine<T> = {
    name,
    handlers,
    instructions() {
      if (!iterator) {
        iterator = delimit(routine, operation)[Symbol.iterator]();
      }
      return iterator;
    },
    *with(newHandlers, op) {
      let originalHandlers = routine.handlers;
      try {
        routine.handlers = Object.assign(
          Object.create(originalHandlers),
          newHandlers,
        );
        return yield* op(routine);
      } finally {
        routine.handlers = originalHandlers;
      }
    },
    next: (instruction) => reducer.reduce(routine, instruction),
  };

  return routine;
}

export function delimitControl<T>(): Delimiter<T, T, Control> {
  let exitSuspendPoint = () => {};

  let escape: Result<void> | void = void (0);

  return {
    delimit: function* control(routine, next) {
      try {
        return yield* next(routine);
      } finally {
        if (escape && !escape.ok) {
          let { error } = escape;
          throw error;
        }
      }
    },
    handlers: {
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
            escape = control.result;
            exitSuspendPoint();
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
              let settled = false;
              let settle = (result: Result<unknown>) => {
                if (!settled) {
                  exitSuspendPoint();
                  routine.next(Resume(result));
                }
              };
              let resolve = (value: unknown) => settle(Ok(value));
              let reject = (error: Error) => settle(Err(error));
              let unsuspend = control.unsuspend(resolve, reject) ?? (() => {});
              exitSuspendPoint = () => {
                exitSuspendPoint = () => {};
                unsuspend();
              };
            }
          }
        } catch (error) {
          routine.next(Done(Err(error)));
        }
      },
    },
  };
}

class Reducer {
  reducing = false;
  readonly queue: [Coroutine, Instruction][] = [];

  reduce(routine: Coroutine, instruction: Instruction) {
    let { queue } = this;
    queue.unshift([routine, instruction]);
    if (this.reducing) return;

    try {
      this.reducing = true;

      let item = queue.pop();
      while (item) {
        [routine, instruction] = item;
        let { handler: handlerName, data } = instruction;
        let handler = routine.handlers[handlerName];
        if (!handler) {
          let error = new Error(handlerName);
          error.name = `UnknownHandler`;
          this.reduce(routine, Resume(Err(error)));
        } else {
          handler(routine, data);
        }
        item = queue.pop();
      }
    } finally {
      this.reducing = false;
    }
  }
}
