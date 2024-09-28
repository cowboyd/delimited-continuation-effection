import { createContext } from "./context.ts";
import { Err, Ok } from "./result.ts";
import { Operation, Scope, Task } from "./types.ts";

const Tasks = createContext<TaskGroup>("@effection/tasks");

export class TaskGroup {
  static create(scope: Scope): TaskGroup {
    return scope.set(Tasks, new TaskGroup());
  }

  static expect(scope: Scope): TaskGroup {
    return scope.expect(Tasks);
  }

  static encapsulate<T>(operation: () => Operation<T>): Operation<T> {
    return Tasks.with(new TaskGroup(), function* (tasks) {
      try {
        return yield* operation();
      } finally {
        yield* tasks.halt();
      }
    });
  }

  tasks: Set<Task<unknown>> = new Set();

  add(task: Task<unknown>) {
    return this.tasks.add(task);
  }

  delete(task: Task<unknown>) {
    return this.tasks.delete(task);
  }

  *halt() {
    let { tasks } = this;
    let teardown = Ok();
    while (tasks.size > 0) {
      for (let child of [...tasks].reverse()) {
        try {
          yield* child.halt();
        } catch (error) {
          teardown = Err(error);
        } finally {
          tasks.delete(child);
        }
      }
    }
    if (!teardown.ok) {
      throw teardown.error;
    }
  }
}
