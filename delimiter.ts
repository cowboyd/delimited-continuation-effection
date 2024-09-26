import { useCoroutine } from "./coroutine.ts";
import type { Delimiter, Operation } from "./types.ts";

export function delimit<A, B>(
  delimiters: [Delimiter<A, B>],
  op: () => Operation<A>,
): Operation<B>;
export function delimit<A, B, C>(
  delimiters: [Delimiter<A, B>, Delimiter<B, C>],
  op: () => Operation<A>,
): Operation<C>;
export function delimit<A, B, C, D>(
  delimiters: [Delimiter<A, B>, Delimiter<B, C>, Delimiter<C, D>],
  op: () => Operation<A>,
): Operation<D>;
export function delimit<A, B, C, D, E>(
  delimiters: [
    Delimiter<A, B>,
    Delimiter<B, C>,
    Delimiter<C, D>,
    Delimiter<D, E>,
  ],
  op: () => Operation<A>,
): Operation<E>;
export function* delimit(
  delimiters: Delimiter<unknown>[],
  op: () => Operation<unknown>,
): Operation<unknown> {
  let routine = yield* useCoroutine();
  //@ts-expect-error wh
  return yield* compose(delimiters)(routine, op);
}
