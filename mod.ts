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
  let routine = new Routine("evaluate", op(...args)[Symbol.iterator]());
  return reduce([
    new Resume(routine),
  ]);
}

function reduce(stack: Thunk[]): unknown {
  let result = Ok<unknown>(void 0);
  while (true) {
    let thunk = stack.pop();
    if (!thunk) {
      return unbox(result);
    } else if (thunk.type === "resume") {
      let { routine } = thunk;
      const next = iterate(routine, result);
      if (next.done) {
        stack.push(new Return(routine, next.value));
      } else {
        const instruction = next.value;
        if (instruction.type === "shift") {
          let { block } = instruction;
          let result: Result<unknown> | undefined = void 0;
          let subroutine: Routine | undefined = void 0;
          const k: Continuation<unknown, unknown> = (value) => ({
            *[Symbol.iterator]() {
              if (result) {
                return result;
              } else {
                result = Ok(value);
                stack.push(
                  new Resume(routine),
                  new Return(subroutine!, result),
                );
              }
            },
          });
          subroutine = new Routine(
            `shift ${block.name}()`,
            block(k)[Symbol.iterator](),
            routine,
          );
          stack.push(
            new Resume(subroutine),
          );
        } else if (instruction.type === "reset") {
          let { block } = instruction;
          stack.push(
            new Resume(routine),
            new Resume(
              new Routine(
                `reset ${block.name}()`,
                block()[Symbol.iterator](),
                routine,
              ),
            ),
          );
        }
      }
    } else if (thunk.type === "return") {
      result = thunk.result;
    } else {
      //@ts-ignore-error it is good for TS to be unhappy about this
      throw new Error(`unknown thunk type: ${thunk.type}`);
    }
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

type Thunk = Resume | Return;

class Resume {
  type = "resume" as const;
  constructor(public readonly routine: Routine) {}
}

class Return {
  type = "return" as const;
  constructor(
    public readonly routine: Routine,
    public result: Result<unknown>,
  ) {}
}

class Routine {
  subroutines = new Set<Routine>();
  constructor(
    public readonly name: string,
    public readonly instructions: Iterator<Instruction, unknown, unknown>,
    public readonly parent?: Routine,
  ) {
    this.parent?.subroutines.add(this);
  }
}
