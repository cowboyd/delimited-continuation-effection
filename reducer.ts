import { Resume } from "./control.ts";
import { Err } from "./result.ts";
import { Coroutine, Instruction } from "./types.ts";

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