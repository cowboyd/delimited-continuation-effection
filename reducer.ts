import { Instruction } from "./control.ts";
import { serialize } from "./serializable.ts";
import { Coroutine } from "./types.ts";

export class Reducer {
  reducing = false;
  readonly queue: [number, Coroutine, Instruction][] = [];

  reduce = (routine: Coroutine, instruction: Instruction, priority: number) => {
    let { queue } = this;
    logEnqueue([priority, routine, instruction], queue);
    let index = queue.findIndex(([p]) => p > priority);
    if (index === -1) {
      queue.push([priority, routine, instruction]);
    } else {
      queue.splice(index, 0, [priority, routine, instruction]);
    }
    if (this.reducing) return;

    try {
      this.reducing = true;

      let item = queue.shift();
      while (item) {
        log(item, queue);
        [, routine, instruction] = item;
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

        item = queue.shift();
      }
    } finally {
      this.reducing = false;
    }
  };
}

Deno.truncateSync("instruction.log");

function log(thunk: Thunk, queue: Thunk[]) {
  Deno.writeTextFileSync(
    "instruction.log",
    `${JSON.stringify(toJSON(thunk))} <-- ${
      JSON.stringify(queue.map(toJSON))
    }\n-------------\n`,
    { append: true, create: true },
  );
}

function logEnqueue(thunk: Thunk, queue: Thunk[]) {
  Deno.writeTextFileSync(
    "instruction.log",
    `${JSON.stringify(toJSON(thunk))} --> ${
      JSON.stringify(queue.map(toJSON))
    }\n`,
    { append: true, create: true },
  );
}

type Thunk = [number, Coroutine, Instruction];

function toJSON([p, routine, instruction]: Thunk) {
  return {
    p,
    ...serialize(instruction) as object,
    on: routine.id,
  };
}
