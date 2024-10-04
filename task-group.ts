import { createContext } from "./context.ts";
import { Err, Ok } from "./result.ts";
import { Operation, Scope, Task } from "./types.ts";

const Tasks = createContext<TaskGroup>("@effection/tasks");

export class TaskGroup {
  static transfer(from: Scope, to: Scope) {
    let newSiblings = to.expect(Tasks);
    let oldSiblings = from.expect(Tasks);

    for (let task of oldSiblings.tasks) {
      oldSiblings.tasks.delete(task);
      newSiblings.tasks.add(task);
    }
  }

  static ensureOwn(scope: Scope): TaskGroup {
    if (!scope.hasOwn(Tasks)) {
      scope.set(Tasks, new TaskGroup());
    }
    return scope.expect(Tasks);
  }

  static *halt(scope: Scope): Operation<void> {
    if (scope.hasOwn(Tasks)) {
      let tasks = scope.expect(Tasks);
      yield* tasks.halt();
    }
  }

  tasks: Set<Task<unknown>> = new Set();

  add(task: Task<unknown>) {
    return this.tasks.add(task);
  }

  delete(task: Task<unknown>) {
    return this.tasks.delete(task);
  }

  *halt(): Operation<void> {
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
