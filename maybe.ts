import { Err, Ok, Result } from "./result.ts";

export type Maybe<T> = {
  type: "just";
  result: Result<T>;
} | {
  type: "none";
  result: Result<void>;
};

export function Just<T>(result: Result<T>): Maybe<T> {
  return { type: "just", result };
}

export function None<T>(error?: Error): Maybe<T> {
  if (error) {
    return { type: "none", result: Err(error) };
  } else {
    return { type: "none", result: Ok() };
  }
}
