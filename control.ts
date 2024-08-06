import { Result } from "./result.ts";
import { Instruction, Reject, Resolve } from "./types.ts";

export type Control = Resume | Suspend | Break | Done;

export interface Done {
  method: "done";
  result: Result<unknown>;
}

export function Done(result: Result<unknown>): Instruction<Done> {
  return { handler: "@effection/coroutine", data: { method: "done", result } };
}

export interface Suspend {
  method: "suspend";
  unsuspend?: Unsuspend<unknown>;
}

export interface Unsuspend<T> {
  (resolve: Resolve<T>, reject: Reject): () => void;
}

export function Suspend<T = void>(
  unsuspend?: Unsuspend<T>,
): Instruction<Suspend> {
  return {
    handler: "@effection/coroutine",
    data: { method: "suspend", unsuspend },
  };
}

export interface Resume {
  method: "resume";
  result: Result<unknown>;
}

export function Resume(result: Result<unknown>): Instruction<Resume> {
  return {
    handler: "@effection/coroutine",
    data: { method: "resume", result },
  };
}

export interface Break {
  method: "break";
  result: Result<void>;
}

export function Break(result: Result<void>): Instruction<Break> {
  return { handler: "@effection/coroutine", data: { method: "break", result } };
}
