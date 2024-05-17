export interface Operation<T> {
  [Symbol.iterator](): Iterator<Instruction, T, unknown>;
}

export interface Task<T> extends Operation<T>, Promise<T> {
  halt(): Operation<void>;
}

export interface Delimiter {
  drop(): Operation<void>;
}

export type Instruction = {
  type: "spawn";
  block(): Operation<unknown>;
} | {
  type: "suspend";
  resume?: (resolve: Resolve<unknown>, reject: Reject) => void | (() => void);
} | {
  type: "pushdelimiter";
} | {
  type: "popdelimiter";
};

export type Resolve<T> = (value: T) => void;
export type Reject = (error: Error) => void;
