import type { Instruction } from "./control.ts";

export interface Operation<T> {
  [Symbol.iterator](): Iterator<Instruction, T, unknown>;
}

export interface Future<T> extends Operation<T>, Promise<T> {}

export interface Task<T> extends Future<T> {
  halt(): Future<void>;
}

export interface Subscription<T, TDone> {
  next(): Operation<IteratorResult<T, TDone>>;
}

export interface Scope {
  get<T>(context: Context<T>): T | undefined;
  set<T>(context: Context<T>, value: T): T;
  delete<T>(context: Context<T>): boolean;
  hasOwn<T>(context: Context<T>): boolean;
  expect<T>(context: Context<T>): T;
  run<T>(operation: () => Operation<T>): Task<T>;
  spawn<T>(operation: () => Operation<T>): Operation<Task<T>>;
  eval<T>(operation: () => Operation<T>): Operation<T>;
}

export type Yielded<T extends Operation<unknown>> = T extends
  Operation<infer TYield> ? TYield
  : never;

export interface Coroutine<T = unknown> {
  name: string;
  scope: Scope;
  stack: {
    haltInstruction: Instruction;
    pushDelimiter(): void;
    popDelimiter(): Instruction;
    setExitWith(instruction: Instruction): Instruction;
  };
  instructions(): Iterator<Instruction, T, unknown>;
  next<I>(instruction: Instruction): void;
}

export interface Context<T> {
  name: string;
  defaultValue?: T;
  get(): Operation<T | undefined>;
  set(value: T): Operation<T>;
  expect(): Operation<T>;
  delete(): Operation<boolean>;
  with<R>(value: T, opperation: (value: T) => Operation<R>): Operation<R>;
}

export type Resolve<T> = (value: T) => void;
export type Reject = (error: Error) => void;
