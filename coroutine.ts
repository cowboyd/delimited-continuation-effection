import { Control, Done, Resume } from "./control.ts";
import { Err, Ok, Result } from "./result.ts";
import type {
  Coroutine,
  Instruction,
  InstructionHandler,
  Operation,
} from "./types.ts";

export interface CoroutineOptions<T> {
  name?: string;
  operation(routine: Coroutine): Operation<T>;
  reducer?: Reducer;
  handlers?: Record<string, InstructionHandler>;
}

export function createCoroutine<T>(options: CoroutineOptions<T>): Coroutine<T> {
  let { operation, reducer = new Reducer(), name = options.operation.name } =
    options;

  let iterator: Iterator<Instruction, T, unknown> | undefined;

  let routine: Coroutine<T> = {
    name,
    handlers: options.handlers ??
      coroutineHandlers() as Record<string, InstructionHandler>,
    instructions() {
      if (!iterator) {
        iterator = operation(routine)[Symbol.iterator]();
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

function coroutineHandlers(): Record<string, InstructionHandler<Control>> {
  //TODO: contextualize e.g. let exit = routine.var("@effection/control.unsuspend", () => {});
  let exitSuspendPoint = () => {};

  return {
    ["@effection/coroutine"](routine, control) {
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
