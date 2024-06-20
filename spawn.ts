// import { createTask } from "./run.ts";
// import type { Delimiter, Instruction, Operation, Task } from "./types.ts";

// interface Spawn {
//   (): Operation<unknown>;
// }

// export function spawnScope(): Delimiter<Spawn> {
//   let tasks = new Set<Task<unknown>>();
//   return {
//     handler: "@effection/spawn",
//     handle(operation, routine) {
//       let task = createTask<T>(operation, reduce)
//     },
    
//     *delimit(operation) {
//       try {
// 	return yield* operation();
//       } finally {
// 	//destroy
//       }
//     }
//   }
// }

// export function spawn<T>(block: () => Operation<T>): Operation<Task<T>> {
//   return {
//     *[Symbol.iterator]() {
//       let instruction: Instruction<Spawn> = {
// 	handler: "@effection/spawn",
// 	data: block,
//       }
//       return (yield instruction) as Task<T>;
//     },
//   };
// }
