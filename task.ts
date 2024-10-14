import { Parent, Routine } from "./contexts.ts";
import { Do, Resume } from "./control.ts";
import { Ok } from "./result.ts";
import { createCoroutine } from "./coroutine.ts";
import { createFutureWithResolvers } from "./future.ts";
import { Coroutine, Future, Operation, Scope, Task } from "./types.ts";

export interface TaskOptions<T> {
  operation(): Operation<T>;
  scope: Scope;
}

export function createTask<T>(options: TaskOptions<T>): [Task<T>, Coroutine] {
  let { scope, operation: { name } } = options;
  let result = createFutureWithResolvers<T>();
  let finalized = createFutureWithResolvers<void>();

  let halted = false;

  let routine = createCoroutine({
    name,
    scope,
    *operation() {
      try {
        let value = yield* options.operation();
        if (!halted) {
          result.resolve(value);
        }
      } catch (error) {
        result.reject(error);
        finalized.reject(error);
      } finally {
        finalized.resolve();
        if (halted) {
          result.reject(new Error("halted"));
        }
      }
    },
  });

  scope.set(Routine, routine);

  let halt = () =>
    toFuture(function* halt() {
      yield Do(({ next, stack }) => {
        if (!halted) {
          halted = true;
          routine.next(stack.haltInstruction);
        }
        next(Resume(Ok()));
      }, "halt");
      yield* finalized.future;
    }, scope.expect(Parent));

  let task: Task<T> = Object.create(result.future, {
    [Symbol.toStringTag]: {
      enumerable: false,
      value: "Task",
    },
    halt: {
      enumerable: false,
      value: halt,
    },
  });

  return [task, routine];
}

function toFuture<T>(op: () => Operation<T>, scope: Scope): Future<T> {
  let _task: Task<T> | void;
  let task = () => _task ?? (_task = scope.run(op));
  return {
    [Symbol.toStringTag]: "Future",
    [Symbol.iterator]: () => op()[Symbol.iterator](),
    then: (fn, ...args) => {
      if (fn) {
        return task().then((...x) => fn(...x), ...args);
      } else {
        return task().then(fn, ...args);
      }
    },
    catch: (...args) => task().catch(...args),
    finally: (...args) => task().catch(...args),
  } as Future<T>;
}
