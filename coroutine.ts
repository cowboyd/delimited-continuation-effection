import { ControlOptions, createControlDelimiter, Self } from "./control.ts";
import { Reduce } from "./reduce.ts";
import type { Coroutine, Delimiter, Instruction, Operation } from "./types.ts";

export interface CoroutineOptions<T> extends ControlOptions<T> {
  operation(): Operation<T>;
  reduce: Reduce;
  parent?: Record<string, Delimiter>;
}

export function useSelf(): Operation<Coroutine> {
  return {
    *[Symbol.iterator]() {
      return (yield Self()) as Coroutine;
    },
  };
}

export function createCoroutine<T>(options: CoroutineOptions<T>): Coroutine<T> {
  let { reduce } = options;
  let parent = options.parent ?? Object.create(null);

  let iterator: Iterator<Instruction, T, unknown> | undefined = undefined;

  let { handle, delimit } = createControlDelimiter(options);

  let handlers = Object.create(parent, {
    "@effection/coroutine": { value: { handle } },
  });

  let operation = () => delimit(options.operation);

  let routine: Coroutine<T> = {
    handlers,
    reduce,
    [Symbol.iterator]() {
      if (!iterator) {
        iterator = operation()[Symbol.iterator]();
      }
      return iterator;
    },
  };

  return routine;
}
