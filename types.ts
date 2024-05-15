export interface Operation<T> {
  [Symbol.iterator](): Iterator<Instruction, T, unknown>;
}

export interface Task<T> extends Operation<T>, Promise<T> {
  halt(): Task<void>;
}

export type Instruction = {
  type: "spawn";
  block(): Operation<unknown>;
} | {
  type: "suspend";
  resume?: (resolve: Resolve<unknown>, reject: Reject) => void | (() => void);
};

export type Resolve<T> = (value: T) => void;
export type Reject = (error: Error) => void;
