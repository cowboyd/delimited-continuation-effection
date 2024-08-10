// deno-lint-ignore-file no-explicit-any
import {
  Control,
  Done,
  Errormark,
  Popmark,
  Pushmark,
  Resume,
  Self,
  Suspend,
} from "./control.ts";
import { Err, Ok, Result } from "./result.ts";
import type { Coroutine, Delimiter, Instruction, Operation } from "./types.ts";

export interface CoroutineOptions<T> {
  name?: string;
  operation(routine: Coroutine): Operation<T>;
  reduce?(routine: Coroutine, instruction: Instruction): void;
  delimiters: Delimiter<T, T, any>[];
}

export function createCoroutine<T>(options: CoroutineOptions<T>): Coroutine<T> {
  let {
    operation,
    reduce = new Reducer().reduce,
    name = options.operation.name,
    delimiters,
  } = options;

  let iterator: Iterator<Instruction, T, unknown> | undefined;

  let handlers = Object.assign(
    controlHandlers(),
    ...delimiters.map((d) => d.handlers),
  );

  let delimit = options.delimiters.reduceRight(
    (delimit, current) => {
      return (routine, next) =>
        current.delimit(routine, (routine) => delimit(routine, next));
    },
    (routine: Coroutine, next: (routine: Coroutine) => Operation<T>) =>
      next(routine),
  );

  let routine: Coroutine<T> = {
    name,
    handlers,
    reduce,
    instructions() {
      if (!iterator) {
        iterator = delimit(routine, operation)[Symbol.iterator]();
      }
      return iterator;
    },
    next: (instruction) => reduce(routine, instruction),
  };

  return routine;
}

export function delimitControl<T>(): Delimiter<T, T, Control> {
  return {
    delimit: function* control(routine, next) {
      try {
        yield Pushmark();
        return yield* next(routine);
      } catch (error) {
        throw yield Errormark(error);
      } finally {
        yield Popmark();
      }
    },
  };
}

function controlHandlers() {
  let marks: Result<void>[] = [];

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
          let mark = marks.pop();
          if (mark) {
            marks.push(control.result);
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
          } else {
            routine.next(
              Resume(Err(new Error(`cannot break without an active mark`))),
            );
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
          marks.push(Ok());
          routine.next(Resume(Ok()));
        } else if (control.method === "popmark") {
          let mark = marks.pop() ?? Ok();
          routine.next(Resume(mark));
        } else if (control.method === "errormark") {
          let mark = marks.pop();
          if (mark) {
            mark = Err(control.error);
            marks.push(mark);
            routine.next(Resume(mark));
          } else {
            routine.next(
              Resume(
                Err(
                  new Error(
                    `no active mark to set error`,
                  ),
                ),
              ),
            );
          }
        }
      } catch (error) {
        routine.next(Done(Err(error)));
      }
    },
  };
}

export function* useCoroutine(): Operation<Coroutine<unknown>> {
  return (yield Self()) as Coroutine<unknown>;
}

class Reducer {
  reducing = false;
  readonly queue: [Coroutine, Instruction][] = [];

  reduce = (routine: Coroutine, instruction: Instruction) => {
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
  };
}
