import { Result } from "./result.ts";
import { Coroutine } from "./types.ts";

export type Instruction =
  | Resume
  | Break
  | Done
  | Do;

export interface Done {
  method: "done";
  result: Result<unknown>;
}

export function Done(result: Result<unknown>): Done {
  return { method: "done", result };
}

export interface Resume {
  method: "resume";
  result: Result<unknown>;
}

export function Resume(result: Result<unknown>): Resume {
  return {
    method: "resume",
    result,
  };
}

export interface Break {
  method: "break";
  result: Result<void>;
}

export function Break(result: Result<void>): Break {
  return { method: "break", result };
}

export interface Do {
  method: "do";
  fn(routine: Coroutine): void;
}

export function Do(fn: (routine: Coroutine) => void): Do {
  return { method: "do", fn };
}
