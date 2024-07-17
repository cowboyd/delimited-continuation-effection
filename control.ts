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

// import { Err, Ok, Result } from "./result.ts";
// import { Delimiter, Instruction, Reject, Resolve } from "./types.ts";

// export function Done<T>(result: Result<T>): Instruction {
//   return {
//     handler: "@effection/control",
//     data: { method: "done", result },
//   };
// }

// export function Resume<T>(result: Result<T>): Instruction {
//   return {
//     handler: "@effection/control",
//     data: { method: "resume", result },
//   };
// }

// export function Break<T>(result: Result<T>): Instruction {
//   return { handler: "@effection/control", data: { method: "break", result } };
// }

// export function Self(): Instruction<Control> {
//   return { handler: "@effection/control", data: { method: "self" } };
// }

// export interface Unsuspend<T> {
//   (resolve: Resolve<T>, reject: Reject): () => void;
// }

// export function Suspend(unsuspend?: Unsuspend<unknown>): Instruction<Control> {
//   return {
//     handler: "@effection/control",
//     data: { method: "suspend", unsuspend },
//   };
// }

// export type Control = {
//   method: "resume";
//   result: Result<unknown>;
// } | {
//   method: "break";
//   result: Result<void>;
// } | {
//   method: "self";
// } | {
//   method: "suspend";
//   unsuspend?: Unsuspend<unknown>;
// } | {
//   method: "done";
//   result: Result<unknown>;
// };

// export interface ControlOptions<T> {
//   done(value: Result<T>): void;
// }

// export function createControlDelimiter<T>(
//   options: ControlOptions<T>,
// ): Delimiter<Control> {
//   let exit = Ok();

//   let exitSuspendPoint = () => {};

//   return {
//     name: "@effection/control",
//     handle(control, routine) {
//       let { reduce, [Symbol.iterator]: instructions } = routine;
//       try {
//         let iterator = instructions();
//         if (control.method === "self") {
//           reduce(routine, Resume(Ok(routine)));
//         } else if (control.method === "resume") {
//           exitSuspendPoint();
//           let result = control.result;
//           if (result.ok) {
//             let next = iterator.next(result.value);
//             if (next.done) {
//               reduce(routine, Done(Ok(next.value)));
//             } else {
//               reduce(routine, next.value);
//             }
//           } else if (iterator.throw) {
//             let next = iterator.throw(result.error);
//             if (next.done) {
//               reduce(routine, Done(Ok(next.value)));
//             } else {
//               reduce(routine, next.value);
//             }
//           } else {
//             throw result.error;
//           }
//         } else if (control.method === "break") {
//           exitSuspendPoint();
//           if (!control.result.ok) {
//             exit = control.result;
//           }
//           if (iterator.return) {
//             let next = iterator.return();
//             if (next.done) {
//               reduce(routine, Done(Ok(next.value)));
//             } else {
//               reduce(routine, next.value);
//             }
//           } else {
//             reduce(routine, Done(Ok()));
//           }
//         } else if (control.method === "suspend") {
//           if (control.unsuspend) {
//             let settled = false;
//             let settle = (result: Result<unknown>) => {
//               if (!settled) {
//                 exitSuspendPoint();
//                 reduce(routine, Resume(result));
//               }
//             };
//             let resolve = (value: unknown) => settle(Ok(value));
//             let reject = (error: Error) => settle(Err(error));
//             let unsuspend = control.unsuspend(resolve, reject) ?? (() => {});
//             exitSuspendPoint = () => {
//               exitSuspendPoint = () => {};
//               unsuspend();
//             };
//           }
//         } else if (control.method === "done") {
//           options.done(control.result as Result<T>);
//         }
//       } catch (error) {
//         options.done(Err(error));
//       }
//     },
//     *delimit(op) {
//       try {
//         return yield* op();
//       } finally {
//         if (!exit.ok) {
//           // deno-lint-ignore no-unsafe-finally
//           throw exit.error;
//         }
//       }
//     },
//   };
// }
