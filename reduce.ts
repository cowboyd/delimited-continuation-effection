import { Resume } from "./coroutine.ts";
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
        let { handler, data } = instruction;
        let delimiter = routine.handlers[handler];
        if (!delimiter) {
          let error = new Error(handler);
          error.name = `UnknownHandler`;
          routine.next(Resume(Err(error)));
        } else {
          delimiter.handle(data, routine);
        }
        item = queue.pop();
      }
    } finally {
      this.reducing = false;
    }
  };
}
