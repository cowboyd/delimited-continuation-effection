import { Result } from "./result.ts";

export type Maybe<T> = {
  type: "just";
  result: Result<T>;
} | {
  type: "none";
};

export function Just<T>(result: Result<T>): Maybe<T> {
  return { type: "just", result };
}

const none = { type: "none" };

export function None<T>(): Maybe<T> {
  return none as Maybe<T>;
}
