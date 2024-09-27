import { createContext } from "./context.ts";
import { Reducer } from "./reducer.ts";
import { Coroutine, Task } from "./types.ts";

const { reduce } = new Reducer();

export const Tasks = createContext<Set<Task<unknown>>>("@effection/tasks");
export const Routine = createContext<Coroutine>("@effection/coroutine");
export const Reduce = createContext<typeof reduce>("@effection/reduce", reduce);
