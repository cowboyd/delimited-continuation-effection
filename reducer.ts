import { Instruction } from "./control.ts";
import { Coroutine } from "./types.ts";

export class Reducer {
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
        const iterator = routine.instructions();

        if (instruction.method === "resume") {
          let result = instruction.result;
          if (result.ok) {
            let next = iterator.next(result.value);
            if (!next.done) {
              routine.next(next.value);
            }
          } else if (iterator.throw) {
            let next = iterator.throw(result.error);
            if (!next.done) {
              routine.next(next.value);
            }
          } else {
            throw result.error;
          }
        } else if (instruction.method === "break") {
          routine.stack.setExitWith(instruction.instruction);

          if (iterator.return) {
            let next = iterator.return();
            if (!next.done) {
              routine.next(next.value);
            }
          }
        } else if (instruction.method === "do") {
          instruction.fn(routine);
        }

        item = queue.pop();
      }
    } finally {
      this.reducing = false;
    }
  };
}
