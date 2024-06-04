export interface Operation<T> {
  [Symbol.iterator](): Iterator<Instruction, T, unknown>;
}

export interface Task<T> extends Operation<T>, Promise<T> {
  //  halt(): Operation<void>;
}

export interface Coroutine<T = unknown> {
  instructions: Iterator<Instruction, T, unknown>;
  handlers: Record<string, Delimiter>;
  next(instruction: Instruction): void;
}

export interface Delimiter<TData = unknown> {
  handler: string;
  handle(data: TData, routine: Coroutine): void;
  delimit<T>(operation: () => Operation<T>): Operation<T>;
}

export interface Instruction<TData = unknown> {
  handler: string;
  data: TData;
}

export type Resolve<T> = (value: T) => void;
export type Reject = (error: Error) => void;

export interface Unsuspend<T> {
  (resolve: Resolve<T>, reject: Reject): () => void;
}
