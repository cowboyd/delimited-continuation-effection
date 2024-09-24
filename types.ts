import type { Result } from "./result.ts";
import type { Instruction } from "./control.ts";

export interface Operation<T> {
  [Symbol.iterator](): Iterator<Instruction, T, unknown>;
}

export interface Future<T> extends Operation<T>, Promise<T> {}

export interface Task<T> extends Future<T> {
  halt(): Future<void>;
}

export interface Scope {
  // readonly context: Record<string, unknown>;
  get<T>(context: Context<T>): T;
  set<T>(context: Context<T>, value: T): T;
  // spawn<T>(operation: () => Operation<T>): Operation<Task<T>>;
  // eval<T>(operation: Operation<T>): Operation<T>;
}

export type Yielded<T extends Operation<unknown>> = T extends
  Operation<infer TYield> ? TYield
  : never;

export interface Coroutine<T = unknown> {
  name: string;
  context: Record<string, unknown>;
  stack: {
    pushDelimiter(): void;
    popDelimiter(): Result<unknown>;
    setDelimiterExitResult(result: Result<unknown>): Result<unknown>;
  };
  instructions(): Iterator<Instruction, T, unknown>;
  reduce(routine: Coroutine, instruction: Instruction): void;
  next<I>(instruction: Instruction): void;
}

export interface Context<T> {
  name: string;
  defaultValue?: T;
  get(): Operation<T | undefined>;
  set(value: T): Operation<T>;
  expect(): Operation<T>;
}

export interface Delimiter<T, TReturn = T> {
  (
    routine: Coroutine,
    next: (routine: Coroutine) => Operation<T>,
  ): Operation<TReturn>;
}

export type Resolve<T> = (value: T) => void;
export type Reject = (error: Error) => void;
