import { Break, Resume } from "./control.ts";
import { Ok } from "./result.ts";
import { createTask } from "./run.ts";
import type { Delimiter, Instruction, Operation, Task } from "./types.ts";

type Spawn = () => Operation<unknown>;

export function spawnScope(): Delimiter<Spawn> {
  let tasks = new Set<Task<unknown>>();
  return {
    name: "@effection/spawn",

    // handle spawns that happen within the scope of this delimiter
    // and add them to the set of tasks
    handle(operation, routine) {
      let { reduce } = routine;
      let [task, child] = createTask({
        operation,
        reduce,
        done: (childTask, result) => {
          tasks.delete(childTask);
          if (!result.ok) {
            reduce(routine, Break(result));
          }
        },
      });
      tasks.add(task);
      reduce(routine, Resume(Ok(task)));
      reduce(child, Resume(Ok()));
    },

    // run the delimited operation, and then halt all
    // tasks created within it afterwards
    *delimit(operation) {
      try {
        return yield* operation();
      } finally {
        while (tasks.size) {
          for (let task of [...tasks].reverse()) {
            tasks.delete(task);
            yield* task.halt();
          }
        }
      }
    },
  };
}

export function spawn<T>(block: () => Operation<T>): Operation<Task<T>> {
  return {
    *[Symbol.iterator]() {
      let instruction: Instruction<Spawn> = {
        handler: "@effection/spawn",
        data: block,
      };
      return (yield instruction) as Task<T>;
    },
  };
}
