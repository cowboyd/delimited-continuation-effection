import { useCoroutine } from "./coroutine.ts";
import type { Delimiter, Operation } from './types.ts';

export function compose<A,B>(delimiters: [Delimiter<A,B>]): Delimiter<A,B>;
export function compose<A,B,C>(delimiters: [Delimiter<A,B>, Delimiter<B,C>]): Delimiter<A,C>;
export function compose<A,B,C,D>(delimiters: [Delimiter<A,B>, Delimiter<B,C>, Delimiter<C,D>]): Delimiter<A,D>;
export function compose<A,B,C,D, E>(delimiters: [Delimiter<A,B>, Delimiter<B,C>, Delimiter<C,D>, Delimiter<D,E>]): Delimiter<A,E>;
export function compose(delimiters: Delimiter<unknown, unknown>[]): Delimiter<unknown, unknown> {
  return delimiters.reduceRight((total, delimiter) => {
    return (coroutine, content) => delimiter(coroutine, function* next(routine) {
	return yield* total(routine, content);      
    });
  })
}

export function delimit<A,B>(delimiters: [Delimiter<A,B>], op: () => Operation<A>): Operation<B>;
export function delimit<A,B,C>(delimiters: [Delimiter<A,B>, Delimiter<B,C>], op: () => Operation<A>): Operation<C>;
export function delimit<A,B,C,D>(delimiters: [Delimiter<A,B>, Delimiter<B,C>, Delimiter<C,D>], op: () => Operation<A>): Operation<D>;
export function delimit<A,B,C,D, E>(delimiters: [Delimiter<A,B>, Delimiter<B,C>, Delimiter<C,D>, Delimiter<D,E>], op: () => Operation<A>): Operation<E>;
export function* delimit(delimiters: Delimiter<unknown>[], op: () => Operation<unknown>): Operation<unknown> {
  let routine = yield* useCoroutine();
  //@ts-expect-error why?
  return yield* compose(delimiters)(routine, op);
}
