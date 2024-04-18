import { Err, Ok, type Result, unbox } from "./result.ts";

export interface Operation<T> {
  [Symbol.iterator](): Iterator<Instruction, T, unknown>;
}

export type Instruction = {
  type: "reset";
  block(): Operation<unknown>;
} | {
  type: "shift";
  block(k: Continuation<unknown, unknown>): Operation<unknown>;
} | {
  type: "suspend";
};

export interface Continuation<T, R> {
  (value: T): Operation<R>;
}

export function reset<T>(block: () => Operation<unknown>): Operation<T> {
  return {
    *[Symbol.iterator]() {
      return (yield { type: "reset", block }) as T;
    },
  };
}

export function shift<T, R, O>(
  block: (k: Continuation<T, R>) => Operation<O>,
): Operation<T> {
  return {
    *[Symbol.iterator]() {
      return (yield { type: "shift", block }) as T;
    },
  };
}

export function evaluate<TArgs extends unknown[]>(
  op: (...args: TArgs) => Operation<unknown>,
  ...args: TArgs
): unknown {
  let routine = new Routine("evaluate", op(...args));
  return reduce(routine);
}

function reduce(routine: Routine): unknown {
  let stack: Array<Routine | Reset> = [routine];
  let register: Result<unknown> = Ok();
  let current = stack.pop();
  while (current && !(current instanceof Reset)) {
    const next = iterate(current, register);
    if (next.done) {
      register = next.value;
    } else {
      stack.push(current);
      const instruction = next.value;
      if (instruction.type === "reset") {
        let { block } = instruction;
        stack.push(
          new Reset(),
          new Routine(instruction.block.name ?? "reset", block()),
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
          new Routine(instruction.block.name ?? "shift", block(k)),
        );
      } else if (instruction.type === "suspend") {
        stack.pop();
      }
    }
    current = stack.pop();
  }
  return unbox(register);
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
  subroutines = new Set<Routine>();
  constructor(
    public readonly name: string,
    instructions: Iterable<Instruction>,
    public readonly parent?: Routine,
  ) {
    this.instructions = instructions[Symbol.iterator]();
    this.parent?.subroutines.add(this);
  }
}
