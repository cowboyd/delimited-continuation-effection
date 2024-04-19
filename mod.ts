import { Err, Ok, type Result, unbox } from "./result.ts";
import { Continuation, Instruction, Operation } from "./types.ts";
export * from "./types.ts";
export * from "./continuation.ts";

export function evaluate<TArgs extends unknown[]>(
  op: (...args: TArgs) => Operation<unknown>,
  ...args: TArgs
): unknown {
  let routine = new Routine("evaluate", op(...args));
  return reduce([routine], Ok());
}

function reduce(stack: (Routine | Reset)[], value: Result<unknown>): unknown {
  let reducing = true;

  try {
    let register = value;
    let reenter = (k: Continuation<unknown, unknown>, value: unknown) => {
      let resume = new Routine(`reenter`, k(value));
      stack.push(resume);
      if (!reducing) {
        reduce(stack, Ok(value));
      }
    };

    let current = stack.pop();
    while (current) {
      if (current instanceof Reset) {
        current = stack.pop();
        continue;
      }
      const next = iterate(current, register);
      if (next.done) {
        const result = next.value;
        current.parent?.subroutines.delete(current);
        register = result;
        if (current.subroutines.size) {
          stack.push(id(result), ...[...current.subroutines].map(exit));
        }
      } else {
        stack.push(current);
        const instruction = next.value;
        if (instruction.type === "reset") {
          let { block } = instruction;
          stack.push(
            new Reset(),
            new Routine(instruction.block.name ?? "reset", block(), current),
          );
        } else if (instruction.type === "shift") {
          let { block } = instruction;
          let frames: Routine[] = [];
          let top = stack.pop();
          while (top && !(top instanceof Reset)) {
            frames.unshift(top);
            top = stack.pop();
          }
          let k: Continuation<unknown, unknown> = (value: unknown) => ({
            *[Symbol.iterator]() {
              register = Ok(value);
              stack.push(new Reset(), ...frames);
              return (yield { type: "suspend" }) as unknown;
            },
          });
          stack.push(
            new Reset(),
            new Routine(
              instruction.block.name ?? "shift",
              block(k, reenter),
              current,
            ),
          );
        } else if (instruction.type === "suspend") {
          stack.pop();
        }
      }
      current = stack.pop();
    }
    return unbox(register);
  } finally {
    reducing = false;
  }
}

function iterate(
  routine: Routine,
  current: Result<unknown>,
): IteratorResult<Instruction, Result<unknown>> {
  let { instructions } = routine;
  try {
    if (current.ok) {
      let next = instructions.next(current.value);
      return next.done
        ? { done: true, value: Ok(next.value) }
        : { done: false, value: next.value };
    } else if (instructions.throw) {
      let next = instructions.throw(current.error);
      return next.done
        ? { done: true, value: Ok(next.value) }
        : { done: false, value: next.value };
    } else {
      return { done: true, value: current };
    }
  } catch (error) {
    return { done: true, value: Err(error) };
  }
}

class Reset {}

class Routine {
  public readonly instructions: Iterator<Instruction, unknown, unknown>;
  public subroutines = new Set<Routine>();
  constructor(
    public readonly name: string,
    instructions: Iterable<Instruction>,
    public readonly parent?: Routine,
  ) {
    this.instructions = instructions[Symbol.iterator]();
    this.parent?.subroutines.add(this);
  }
}

function id(value: Result<unknown>): Routine {
  return new Routine(`id ${JSON.stringify(value)}`, {
    *[Symbol.iterator]() {
      return unbox(value);
    },
  });
}

function exit(routine: Routine): Routine {
  let { instructions } = routine;
  let output = Ok();

  let iterator: typeof routine.instructions = {
    next() {
      iterator.next = (value) => {
        let result = instructions.next(value);
        return result.done ? { done: true, value: unbox(output) } : result;
      };
      if (instructions.return) {
        let result = instructions.return();
        return result.done ? { done: true, value: unbox(output) } : result;
      } else {
        return { done: true, value: unbox(output) };
      }
    },
    throw(err: Error) {
      output = Err(err);
      return iterator.next();
    },
  };
  let exit = new Routine(`exit (${routine.name})`, {
    [Symbol.iterator]: () => iterator,
  });

  exit.subroutines = routine.subroutines;
  return exit;
}
