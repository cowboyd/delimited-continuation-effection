// deno-lint-ignore-file no-explicit-any

export interface Operation<T> {
  [Symbol.iterator](): Iterator<Instruction, T, unknown>;
}

export interface Future<T> extends Operation<T>, Promise<T> {}

export interface Task<T> extends Future<T> {
  halt(): Future<void>;
}

export interface Coroutine<T = unknown> {
  name: string;
  handlers: Record<string, InstructionHandler>;
  instructions(): Iterator<Instruction, T, unknown>;
  with<T>(
    handlers: Record<string, InstructionHandler<any>>,
    op: (routine: Coroutine) => Operation<T>,
  ): Operation<T>;
  next<I>(instruction: Instruction<I>): void;
}

export interface Delimiter<T, TReturn = T, TData = unknown> {
  handlers?: Record<string, InstructionHandler<TData>>;
  delimit(
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
