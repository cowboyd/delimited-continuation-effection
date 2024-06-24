export interface Operation<T> {
  [Symbol.iterator](): Iterator<Instruction, T, unknown>;
}

export interface Future<T> extends Operation<T>, Promise<T> {}

export interface Task<T> extends Future<T> {
  halt(): Future<void>;
}

export interface Coroutine<T = unknown> extends Operation<T> {
  name: string;
  handlers: Record<string, Delimiter>;
  reduce(routine: Coroutine, instruction: Instruction): void;
}

export interface Delimiter<TData = unknown> {
  name: string;
  handle(data: TData, routine: Coroutine): void;
  delimit<T>(operation: () => Operation<T>, routine: Coroutine): Operation<T>;
}

export interface Instruction<TData = unknown> {
  handler: string;
  data: TData;
}

export type Resolve<T> = (value: T) => void;
export type Reject = (error: Error) => void;
