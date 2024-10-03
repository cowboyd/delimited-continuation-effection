import { createContext } from "./context.ts";
import { Reducer } from "./reducer.ts";
import type { Coroutine, Operation, Scope } from "./types.ts";

const { reduce } = new Reducer();

export const Routine = createContext<Coroutine>("@effection/coroutine");

export const Reduce = createContext<typeof reduce>("@effection/reduce", reduce);

export const Parent = createContext<Scope>("@effection/scope.parent");

export const Children = createContext<Children>("@effection/scope.children");

type Children = Map<Scope, () => Operation<void>>;
