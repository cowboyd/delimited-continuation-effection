export interface Operation<T> {
  [Symbol.iterator](): Iterator<Instruction, T, unknown>;
}

export type Instruction = {
  type: "reset";
  block(): Operation<unknown>;
} | {
  type: "shift";
  block(
    k: Continuation<unknown, unknown>,
    // deno-lint-ignore no-explicit-any
    reenter: ReEnter<any>,
  ): Operation<unknown>;
} | {
  type: "suspend";
};

export interface ReEnter<T> {
  (k: Continuation<T, unknown>, value: T): void;
}

export interface Continuation<T, R> {
  (value: T): Operation<R>;
}
