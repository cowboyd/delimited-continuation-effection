import { Do, type Instruction, Resume } from "./control.ts";
import { DelimitedStack } from "./delimited-stack.ts";
import { Reducer } from "./reducer.ts";
import { Err, Ok } from "./result.ts";
import type { Coroutine, Delimiter, Operation } from "./types.ts";

export interface CoroutineOptions<T> {
  name?: string;
  operation(routine: Coroutine): Operation<T>;
  reduce?(routine: Coroutine, instruction: Instruction): void;
  context?: Record<string, unknown>;
}

export function createCoroutine<T>(options: CoroutineOptions<T>): Coroutine<T> {
  let {
    operation,
    reduce = new Reducer().reduce,
    name = options.operation.name,
    context,
  } = options;

  let iterator: Iterator<Instruction, T, unknown> | undefined;

  let routine: Coroutine<T> = {
    name,
    stack: new DelimitedStack(),
    context: Object.create(context ?? null),
    reduce,
    instructions() {
      if (!iterator) {
        iterator = operation(routine)[Symbol.iterator]();
      }
      return iterator;
    },
    next: (instruction) => reduce(routine, instruction),
  };

  return routine;
}

export function* useCoroutine(): Operation<Coroutine> {
  return (yield Do((routine) =>
    routine.next(Resume(Ok(routine)))
  )) as Coroutine;
}

export function controlScope<T>(): Delimiter<T, T> {
  return function* control(routine, next) {
    try {
      yield pushd;
      return yield* next(routine);
    } catch (error) {
      throw yield setd(error);
    } finally {
      yield popd;
    }
  };
}

const pushd = Do(({ stack, next }) => next(Resume(Ok(stack.pushDelimiter()))));

const popd = Do(({ stack, next }) => next(Resume(stack.popDelimiter())));

const setd = (error: Error) =>
  Do(({ stack, next }) =>
    next(Resume(Ok(stack.setDelimiterExitResult(Err(error)))))
  );
