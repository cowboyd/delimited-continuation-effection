import { Just, Maybe, None } from "./maybe.ts";
import { box, Err, Ok, type Result } from "./result.ts";
import { suspend } from "./suspend.ts";
import { Instruction, Operation, Resolve } from "./types.ts";
export * from "./types.ts";
export * from "./sleep.ts";
export * from "./suspend.ts";
export * from "./run.ts";

export class Reducer {
  reducing = false;
  queue: Routine[] = [];

  enter<T>(routine: Routine<T>, value: Next = Ok()): void {
    routine.value = value;
    if (!routine.enqueued) {
      routine.enqueued = true;
      this.queue.push(routine as Routine<unknown>);
    }
    if (this.reducing) return;

    this.reducing = true;

    try {
      while (this.queue.length > 0) {
        const current = this.queue.pop()!;
        current.enqueued = false;
        let { instructions } = current;
        let next: IteratorResult<Instruction, Result<unknown>>;
        try {
          if (current.value === "halt") {
            if (instructions.return) {
              let result = instructions.return();
              next = result.done
                ? { done: true, value: Ok() }
                : { done: false, value: result.value };
            } else {
              next = { done: true, value: Ok() };
            }
          } else if (current.value.ok) {
            let result = instructions.next(current.value.value);
            next = result.done
              ? { done: true, value: Ok(result.value) }
              : { done: false, value: result.value };
          } else if (instructions.throw) {
            let result = instructions.throw(current.value.error);
            next = result.done
              ? { done: true, value: Ok(result.value) }
              : { done: false, value: result.value };
          } else {
            next = { done: true, value: current.value };
          }
        } catch (error) {
          next = { done: true, value: Err(error) };
        }

        if (next.done) {
          current.state = {
            status: "settled",
            teardown: Ok(),
            result: Just(next.value),
          };
          for (let continuation of current.continuations) {
            continuation(current.state);
          }
        } else {
          let instruction = next.value;
          if (instruction.type === "suspend") {
            let { resolve, reject } = routine.suspend();

            if (instruction.resume) {
              routine.unsuspend = (instruction.resume(resolve, reject)) ??
                (() => {});
            }
          }
        }
      }
    } finally {
      this.reducing = false;
    }
  }

  createRoutine<T>(name: string, operation: Operation<T>) {
    return new Routine<T>(name, this, operation);
  }
}

export class Routine<T = unknown> {
  public state: State<T> = { status: "pending" };
  public readonly instructions: Iterator<Instruction, unknown, unknown>;
  public readonly continuations = new Set<Resolve<Settled<T>>>();
  public enqueued = false;
  public value: Next = Ok();
  public unsuspend: () => void = () => {};

  settled(): Operation<Settled<T>> {
    if (this.state.status === "settled") {
      return constant(this.state);
    } else {
      return suspend<Settled<T>>((resolve) => {
        let { continuations } = this;

        continuations.add(resolve);
        return () => {
          continuations.delete(resolve);
        };
      });
    }
  }

  *await(): Operation<T> {
    let settled = yield* this.settled();
    if (settled.result.type === "none") {
      let error = new Error("halted");
      error.name = "HaltError";
      throw error;
    } else if (!settled.result.value.ok) {
      throw settled.result.value.error;
    } else {
      let { value } = settled.result.value;
      return value;
    }
  }

  halt(): Operation<void> {
    return {
      [Symbol.iterator]: function* halt(this: Routine) {
        if (this.state.status === "pending") {
          this.state = { status: "settling", result: None<Result<T>>() };
          this.resume("halt");
        }
        let outcome = yield* this.settled();
        if (!outcome.teardown.ok) {
          throw outcome.teardown.error;
        }
      }.bind(this as Routine),
    };
  }

  constructor(
    public readonly name: string,
    public readonly reducer: Reducer,
    instructions: Iterable<Instruction>,
  ) {
    this.instructions = instructions[Symbol.iterator]();
  }

  suspend() {
    let $resume = (value: Next) => {
      $resume = () => {};
      this.resume(value);
    };
    return {
      resolve: (value: unknown) => $resume(Ok(value)),
      reject: (err: Error) => $resume(Err(err)),
    };
  }

  resume(value: Next) {
    let result = box(() => this.unsuspend());
    this.reducer.enter(this, result.ok ? value : result);
  }
}

type State<T> = Pending | Settling<T> | Settled<T>;

type Pending = {
  readonly status: "pending";
};

type Settling<T> = {
  readonly status: "settling";
  readonly result: Maybe<Result<T>>;
};

type Settled<T> = {
  readonly status: "settled";
  readonly teardown: Result<void>;
  readonly result: Maybe<Result<T>>;
};

type Next<T = unknown> = Result<T> | "halt";

function constant<T>(value: T): Operation<T> {
  return {
    [Symbol.iterator]: () => ({ next: () => ({ done: true, value }) }),
  };
}
