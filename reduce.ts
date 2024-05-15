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
          if (current.children.size === 0) {
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
              current.parent.children.delete(current);
              if (!settled.teardown.ok) {
                current.parent.resume(settled.teardown);
              } else if (
                settled.result.type === "just" && !settled.result.value.ok
              ) {
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
              let error: Error | void = void 0;
              for (let child of [...current.children].reverse()) {
                try {
                  yield* child.halt();
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
          } else {
            let { block } = instruction;
            let task = this.run(block, current);
            current.resume(Ok(task));
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
    if (parent) {
      parent.children.add(routine as Routine);
    }

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

export class Routine<T = unknown> {
  public state: State<T> = { status: "pending" };
  public readonly continuations = new Set<Resolve<Settled<T>>>();
  public readonly children = new Set<Routine<unknown>>();
  public instructions: Iterator<Instruction, unknown, unknown>;
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
    public readonly parent?: Routine,
  ) {
    this.instructions = instructions[Symbol.iterator]();
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
