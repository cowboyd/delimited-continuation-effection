import type { Operation, Task } from "./types.ts";
import { Break, Do, Resume } from "./control.ts";
import { createContext } from "./context.ts";
import { Err, Ok } from "./result.ts";
import { createTask } from "./task.ts";
import { createScope } from "./scope.ts";

export const Tasks = createContext<Set<Task<unknown>>>("@effection/tasks");

export function spawn<T>(op: () => Operation<T>): Operation<Task<T>> {
  return {
    *[Symbol.iterator]() {
      let task = yield Do((routine) => {
        let children = routine.scope.get(Tasks);
        if (!children) {
          routine.next(Resume(Err(new Error(`no children found!!`))));
          return;
        }
        let [scope] = createScope(routine.scope);
        let [start, task] = createTask({
          scope,
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
        });
        children.add(task);
        routine.next(Resume(Ok(task)));
        start();
      });

      return task as Task<T>;
    },
  };
}
