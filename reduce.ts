import { constant } from "./constant.ts";
import { Just, Maybe, None } from "./maybe.ts";
import { box, Err, Ok, Result } from "./result.ts";
import { suspend } from "./suspend.ts";
import type { Instruction, Operation, Resolve, Task } from "./types.ts";

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
          if (current.delimiters.every((d) => d.routines.size === 0)) {
            if (current.state.status === "settling") {
              let result = current.state.result;
              let teardown = next.value as Result<void>;
              current.state = {
                status: "settled",
                teardown,
                result,
              };
            } else {
              current.state = {
                status: "settled",
                teardown: Ok(),
                result: Just(next.value),
              };
            }

            for (let continuation of current.continuations) {
              continuation(current.state);
            }

            let settled = current.state as Settled<unknown>;

            if (current.parent) {
              current.litter?.delete(current);
              if (!settled.teardown.ok) {
                //TODO: Crash Parent
                current.parent.resume(settled.teardown);
              } else if (
                settled.result.type === "just" && !settled.result.value.ok
              ) {
                //TODO: Crash Parent
                current.parent.resume(settled.result.value);
              }
            }
          } else {
            current.state = {
              status: "settling",
              result: current.state.status === "settling"
                ? current.state.result
                : Just(next.value),
            };

            current.instructions = (function* () {
              let { delimiters } = current;
              let error: Error | void = void 0;
              for (
                let delimiter = delimiters.pop();
                delimiter;
                delimiter = delimiters.pop()
              ) {
                try {
                  yield* delimiter.drop();
                } catch (err) {
                  error = err;
                }
                if (error) {
                  throw error;
                }
              }
            })();
            current.resume(Ok());
          }
        } else {
          let instruction = next.value;
          if (instruction.type === "suspend") {
            let { resolve, reject } = current.reentrance();

            if (instruction.resume) {
              current.unsuspend = (instruction.resume(resolve, reject)) ??
                (() => {});
            } else if (current.state.status === "settling") {
              current.resume(Ok());
            }
          } else if (instruction.type === "spawn") {
            let { block } = instruction;
            let task = this.run(block, current);
            current.resume(Ok(task));
          } else if (instruction.type === "pushdelimiter") {
            let delimiter = new Delimiter();
            current.delimiters.push(delimiter);
            current.resume(Ok(delimiter));
          } else if (instruction.type === "popdelimiter") {
            current.delimiters.pop();
            current.resume(Ok());
          } else {
            current.resume(current.value);
          }
        }
      }
    } finally {
      this.reducing = false;
    }
  }

  createRoutine<T>(name: string, operation: Operation<T>, parent?: Routine) {
    return new Routine<T>(name, this, operation, parent);
  }

  run<T>(op: () => Operation<T>, parent?: Routine): Task<T> {
    let routine = this.createRoutine(
      op.name,
      (function* () {
        return yield* op();
      })(),
      parent,
    );

    let $promise: Promise<T> | void = void (0);
    let promise = () => {
      if ($promise) {
        return $promise;
      } else {
        let { promise, resolve, reject } = Promise.withResolvers<T>();
        let settle = (state: Settled<T>) => {
          if (!state.teardown.ok) {
            reject(state.teardown.error);
          } else if (state.result.type === "none") {
            reject(new Error("halted"));
          } else if (state.result.type === "just") {
            let { value } = state.result;
            if (value.ok) {
              resolve(value.value);
            } else {
              reject(value.error);
            }
          }
        };
        if (routine.state.status === "settled") {
          settle(routine.state);
        } else {
          routine.continuations.add(settle);
        }
        return $promise = promise;
      }
    };

    routine.resume(Ok());

    return {
      [Symbol.toStringTag]: "Task",
      [Symbol.iterator]: () => routine.await()[Symbol.iterator](),
      then: (...args) => promise().then(...args),
      catch: (...args) => promise().catch(...args),
      finally: (...args) => promise().finally(...args),
      halt: () => routine.halt(),
    };
  }
}

class Delimiter {
  routines = new Set<Routine>();

  *drop(): Operation<void> {
    let error: Error | void = void 0;
    for (let routine of [...this.routines].reverse()) {
      try {
        yield* routine.halt();
      } catch (err) {
        error = err;
      }
      if (error) {
        throw error;
      }
    }
  }
}

export class Routine<T = unknown> {
  public state: State<T> = { status: "pending" };
  public readonly litter?: Set<Routine>;
  public readonly continuations = new Set<Resolve<Settled<T>>>();
  public instructions: Iterator<Instruction, unknown, unknown>;
  public delimiters: Delimiter[] = [new Delimiter()];
  public enqueued = false;
  public value: Next = Ok();
  public unsuspend: () => void = () => {};

  get delimeter(): Delimiter {
    return this.delimiters[this.delimiters.length - 1];
  }

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
      throw error;
    } else if (!settled.result.value.ok) {
      throw settled.result.value.error;
    } else {
      let { value } = settled.result.value;
      return value;
    }
  }

  exit(outcome: Maybe<Result<T>>): Operation<Settled<T>> {
    this.exit = this.settled;
    return {
      [Symbol.iterator]: function* exit(this: Routine<T>) {
        this.state = { status: "settling", result: outcome };
        if (outcome.type === "none") {
          this.resume("halt");
        } else {
          this.resume(outcome.value);
        }
        return yield* this.settled();
      }.bind(this),
    };
  }

  *halt(): Operation<void> {
    let settled = yield* this.exit(None());
    if (!settled.teardown.ok) {
      throw settled.teardown.error;
    }
  }

  constructor(
    public readonly name: string,
    public readonly reducer: Reducer,
    instructions: Iterable<Instruction>,
    public readonly parent?: Routine,
  ) {
    this.instructions = instructions[Symbol.iterator]();
    if (parent) {
      this.litter = parent.delimeter.routines;
      this.litter.add(this as Routine);
    }
  }

  reentrance() {
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
