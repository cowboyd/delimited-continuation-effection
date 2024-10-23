import type { Result } from "./result.ts";

export interface Operation<T> {
  [Symbol.iterator](): Iterator<Action<unknown>, T, unknown>;
}

export interface Future<T> extends Operation<T>, Promise<T> {}

export interface Task<T> extends Future<T> {
  halt(): Future<void>;
}

export interface Subscription<T, TDone> {
  next(): Operation<IteratorResult<T, TDone>>;
}

export type Stream<T, TReturn> = Operation<Subscription<T, TReturn>>;

export interface Context<T> {
  name: string;
  defaultValue?: T;
  get(): Operation<T | undefined>;
  set(value: T): Operation<T>;
  expect(): Operation<T>;
  delete(): Operation<boolean>;
  with<R>(value: T, opperation: (value: T) => Operation<R>): Operation<R>;
}

export interface Scope {
  get<T>(context: Context<T>): T | undefined;
  set<T>(context: Context<T>, value: T): T;
  delete<T>(context: Context<T>): boolean;
  expect<T>(context: Context<T>): T;
  hasOwn<T>(context: Context<T>): boolean;
  run<T>(operation: () => Operation<T>): Task<T>;
  spawn<T>(operation: () => Operation<T>): Operation<Task<T>>;
}

export type Yielded<T extends Operation<unknown>> = T extends
  Operation<infer TYield> ? TYield
  : never;

export interface Resolve<T> {
  (value: T): void;
}

export interface Action<T> {
  description: string;
  enter(
    resolve: Resolve<Result<T>>,
    routine: Coroutine,
  ): (resolve: Resolve<Result<void>>) => void;
}

export interface Coroutine<T = unknown> {
  scope: Scope;
  data: {
    discard(resolve: Resolve<Result<unknown>>): void;
    iterator: Iterator<Action<unknown>, T, unknown>;
  };
  next(result: Result<unknown>, subscriber?: Subscriber<T>): () => void;
  return<R>(result: Result<R>, subcriber?: Subscriber<void>): () => void;
}

export interface Subscriber<T> {
  (result: IteratorResult<Result<unknown>, Result<T>>): void;
}
