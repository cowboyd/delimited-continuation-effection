import { createContext } from "./context.ts";
import { Reducer } from "./reducer.ts";
import { Coroutine, Operation, Scope, Task } from "./types.ts";

const { reduce } = new Reducer();

export const Tasks = createContext<Set<Task<unknown>>>("@effection/tasks");
export const Scopes = createContext<Map<Scope, () => Operation<void>>>("@effection/scopes");
export const Routine = createContext<Coroutine>("@effection/coroutine");
export const Reduce = createContext<typeof reduce>("@effection/reduce", reduce);
