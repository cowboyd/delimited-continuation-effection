export interface Operation<T> {
  [Symbol.iterator](): Iterator<Instruction, T, unknown>;
}

export interface Future<T> extends Operation<T>, Promise<T> {}

export interface Task<T> extends Future<T> {
  halt(): Future<void>;
}

export interface Coroutine<T = unknown> {
  name: string;
  context: Record<string, unknown>;
  handlers: Record<string, InstructionHandler>;
  instructions(): Iterator<Instruction, T, unknown>;
  reduce(routine: Coroutine, instruction: Instruction): void;
  next<I>(instruction: Instruction<I>): void;
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

export interface Instruction<TData = unknown> {
  handler: string;
  data: TData;
}

export interface InstructionHandler<TData = unknown> {
  (routine: Coroutine, data: TData): void;
}

export type Resolve<T> = (value: T) => void;
export type Reject = (error: Error) => void;
