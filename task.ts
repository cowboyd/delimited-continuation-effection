import { getContext } from "./-context.ts";
import { createContext } from "./context.ts";
import { Break, Resume } from "./control.ts";
import { createCoroutine, delimitControl } from "./coroutine.ts";
import { compose } from "./delimiter.ts";
import { createFutureWithResolvers, FutureWithResolvers } from "./future.ts";
import { Err, Ok } from "./result.ts";
import { Delimiter, Instruction, InstructionHandler } from "./types.ts";
import { Coroutine, Future, Operation, Task } from "./types.ts";

export interface TaskOptions<T> {
  operation(): Operation<T>;
  reduce?(routine: Coroutine, instruction: Instruction): void;
  context?: Record<string, unknown>;
}

export function createTask<T>(options: TaskOptions<T>): [() => void, Task<T>] {
  let { reduce, context, operation: { name } } = options;
  let result = createFutureWithResolvers<T>();
  let finalized = createFutureWithResolvers<void>();

  let state = { halted: false };
  
  let handlers = taskHandlers(state);
  
  let delimit = compose([
    //@ts-expect-error it is ok
    delimitTask(state, result, finalized),
    delimitControl(),
    delimitSpawn(),
  ]);


  let operation = (routine: Coroutine) => delimit(routine, options.operation);

  let routine = createCoroutine({ name, operation, reduce, context, handlers });

  let halted: Future<void> | undefined = void 0;

  let halt = () => halted ? halted : createHalt(routine, finalized.future);

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

  return [() => routine.next(Resume(Ok())), task];
}

const Children = createContext<Set<Task<unknown>>>('@effection/task.children');

function taskHandlers(state: { halted: boolean }){
  return {
      ["@effection/task.spawn"]<T>(
        routine: Coroutine,
        op: () => Operation<T>,
      ) {
	let children = getContext(Children, routine);
	if (!children) {
	  routine.next(Resume(Err(new Error(`no children found!!`))));
	  return;
	}
        let [start, task] = createTask({
	  context: routine.context,
          operation: function* child() {
            try {
              return yield* op();
            } catch (error) {
              routine.next(Break(Err(error)));
              throw error;
            } finally {
              if (typeof task !== "undefined") {
                children.delete(task);
              }
            }
          },
          reduce: routine.reduce,
        });
        children.add(task);
        routine.next(Resume(Ok(task)));
        start();
      },
    ["@effection/task.halt"](routine: Coroutine) {
        if (!state.halted) {
          state.halted = true;
          routine.next(Break(Ok()));
        }
      }
  } as Record<string, InstructionHandler>;
}

function delimitSpawn<T>(): Delimiter<T> {
  return function* spawnScope(routine, next) {
      let children = yield* Children.set(new Set());
      try {
        return yield* next(routine);
      } finally {
        let teardown = Ok();
        while (children.size > 0) {
          for (let child of [...children].reverse()) {
            try {
              yield* child.halt();
            } catch (error) {
              teardown = Err(error);
            } finally {
              children.delete(child);
            }
          }
        }
        if (!teardown.ok) {
          throw teardown.error;
        }
      }
  };
}

function delimitTask<T>(
  state: { halted: boolean },
  result: FutureWithResolvers<T>,
  finalized: FutureWithResolvers<void>,
): Delimiter<T, void> {
  return function* task(routine, resume) {
      try {
        let value = yield* resume(routine);

        if (!state.halted) {
          result.resolve(value);
        }
      } catch (error) {
        result.reject(error);
        finalized.reject(error);
      } finally {
        finalized.resolve();
        if (state.halted) {
          result.reject(new Error("halted"));
        }
      }
  };
}

function Halt(): Instruction<void> {
  return { handler: "@effection/task.halt" } as Instruction<void>;
}

function createHalt(
  routine: Coroutine,
  finalized: Future<void>,
): Future<void> {
  return {
    [Symbol.toStringTag]: "Future",
    *[Symbol.iterator]() {
      routine.next(Halt());
      return yield* finalized;
    },
    then: (fn, ...args) => {
      routine.next(Halt());
      if (fn) {
        return finalized.then(() => fn(), ...args);
      } else {
        return finalized.then(fn, ...args);
      }
    },
    catch: (...args) => finalized.catch(...args),
    finally: (...args) => finalized.catch(...args),
  } as Future<void>;
}
