import { Result } from "./result.ts";
import { serializable, serialize } from "./serializable.ts";
import { Coroutine } from "./types.ts";

export type Instruction =
  | Resume
  | Break
  | Do;

export interface Resume {
  method: "resume";
  result: Result<unknown>;
}

export function Resume(result: Result<unknown>): Resume {
  return serializable({ method: "resume", result }, () => ({
    RESUME: result.ok
      ? {
        ok: true,
        ...(result.value !== undefined
          ? { value: serialize(result.value) }
          : undefined),
      }
      : {
        ok: false,
        error: { name: result.error.name, message: result.error.message },
      },
  }));
}

export interface Break {
  method: "break";
  instruction: Instruction;
}

export function Break(instruction: Instruction): Break {
  return serializable({ method: "break", instruction }, () => ({
    BREAK: instruction,
  }));
}

export interface Do {
  method: "do";
  info: unknown;
  fn(routine: Coroutine): void;
}

export function Do(
  fn: (routine: Coroutine) => void,
  info: unknown,
): Do {
  return serializable({ method: "do", info, fn }, () => ({
    DO: info,
  }));
}
