export interface Operation<T> {
  [Symbol.iterator](): Iterator<Instruction, T, unknown>;
}

export type Instruction = {
  type: "pushscope";
} | {
  type: "popscope";
} | {
  type: "reset";
  block(): Operation<unknown>;
} | {
  type: "shift";
  block(k: Continuation<unknown, unknown>): Operation<unknown>;
} | {
  type: "continue";
  instructions: Iterator<Instruction, unknown, unknown>;
  frame: Frame;
  value: unknown;
};

export interface Continuation<T, R> {
  (value: T): Operation<R>;
}

export function scoped<T>(block: () => Operation<T>): Operation<T> {
  return {
    *[Symbol.iterator]() {
      yield { type: "pushscope" };
      try {
        return yield* block();
      } finally {
        yield { type: "popscope" };
      }
    },
  };
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
  let frame = new Frame("evaluate");
  return reduce([
    new Resume(op(...args)[Symbol.iterator](), frame),
  ]);
}

function reduce(stack: Thunk[]): unknown {
  let result = Ok<unknown>(void 0);
  while (true) {
    let thunk = stack.pop();
    if (!thunk) {
      return unbox(result);
    } else if (thunk.type === "resume") {
      let { instructions, frame } = thunk;
      const next = iterate(thunk, result);
      if (next.done) {
        stack.push(new Return(next.value));
      } else {
        const instruction = next.value;
        if (instruction.type === "shift") {
          let { block } = instruction;
          let result: Result<unknown> | undefined = void 0;
          const k: Continuation<unknown, unknown> = (value) => ({
            *[Symbol.iterator]() {
              if (result) {
                return result;
              } else {
                stack.push(
                  new Resume(instructions, frame),
                  new Return(result = Ok(value)),
                );
              }
            },
          });

          stack.push(
            new Resume(block(k)[Symbol.iterator](), new Frame("shift")),
          );
        } else if (instruction.type === "reset") {
          let { block } = instruction;
          stack.push(
            new Resume(instructions, frame),
            new Resume(block()[Symbol.iterator](), new Frame("reset")),
          );
        }
      }
    } else if (thunk.type === "return") {
      result = thunk.result;
    } else if (thunk.type === "destroy") {
      //      console.log({ thunk });
    } else {
      //@ts-ignore-error it is good for TS to be unhappy about this
      throw new Error(`unknown thunk type: ${thunk.type}`);
    }
  }
}

function iterate(
  resume: Resume,
  result: Result<unknown>,
): IteratorResult<Instruction, Result<unknown>> {
  let { instructions } = resume;
  try {
    if (result.ok) {
      let next = instructions.next(result.value);
      return next.done
        ? { done: true, value: Ok(next.value) }
        : { done: false, value: next.value };
    } else if (instructions.throw) {
      let next = instructions.throw(result.error);
      return next.done
        ? { done: true, value: Ok(next.value) }
        : { done: false, value: next.value };
    } else {
      return { done: true, value: result };
    }
  } catch (error) {
    return { done: true, value: Err(error) };
  }
}

type Thunk = {
  readonly type: "resume";
  readonly instructions: Iterator<Instruction, unknown, unknown>;
  readonly frame: Frame;
} | {
  type: "return";
  result: Result<unknown>;
} | {
  type: "destroy";
  frame: Frame;
};

class Resume {
  type = "resume" as const;
  constructor(
    public instructions: Iterator<Instruction, unknown, unknown>,
    public frame: Frame,
  ) {}
}

class Return {
  type = "return" as const;
  constructor(public result: Result<unknown>) {}
}

class Frame {
  children = new Set<Frame>();
  constructor(public readonly name: string, public readonly parent?: Frame) {}
}

type Result<T> = {
  readonly ok: true;
  value: T;
} | {
  readonly ok: false;
  error: Error;
};

export const Ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const Err = <T>(error: Error): Result<T> => ({ ok: false, error });

export function box<T>(fn: () => T): Result<T> {
  try {
    return Ok(fn());
  } catch (error) {
    return Err(error);
  }
}

export function unbox<T>(result: Result<T>): T {
  if (result.ok) {
    return result.value;
  } else {
    throw result.error;
  }
}
