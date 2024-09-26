import type { Operation, Task } from "./types.ts";
import { Break, Do, Resume } from "./control.ts";
import { createContext } from "./context.ts";
import { Err, Ok } from "./result.ts";
import { createTask } from "./task.ts";
import { createScope } from "./scope.ts";

const Children = createContext<Set<Task<unknown>>>("@effection/task.children");

export function spawn<T>(op: () => Operation<T>): Operation<Task<T>> {
  return {
    *[Symbol.iterator]() {
      let task = yield Do((routine) => {
        let children = routine.scope.get(Children);
        if (!children) {
          routine.next(Resume(Err(new Error(`no children found!!`))));
          return;
        }
        let [start, task] = createTask({
          scope: createScope(routine.scope),
          operation: function* child() {
            try {
              return yield* op();
            } catch (error) {
              routine.next(Break(Resume(Err(error))));
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
      });

      return task as Task<T>;
    },
  };
}
