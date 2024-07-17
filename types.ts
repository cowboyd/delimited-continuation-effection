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
    handlers: Record<string, InstructionHandler>,
    op: (routine: Coroutine) => Operation<T>,
  ): Operation<T>;
  next<I>(instruction: Instruction<I>): void;
}

export interface Delimiter<T, TReturn = T> {
  (
    routine: Coroutine,
    resume: (routine: Coroutine) => Operation<T>,
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
