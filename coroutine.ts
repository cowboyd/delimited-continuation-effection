import { ControlOptions, createControlDelimiter, Self } from "./control.ts";
import { Reduce } from "./reduce.ts";
import type { Coroutine, Delimiter, Operation } from "./types.ts";

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

export function createCoroutine<T>(options: CoroutineOptions<T>): Coroutine {
  let { reduce } = options;
  let parent = options.parent ?? {
    "@effection/coroutine": createControlDelimiter(options),
  };

  let handlers = Object.create(parent);

  let routine: Coroutine = {
    handlers,
    reduce,
  };

  return routine;
}
