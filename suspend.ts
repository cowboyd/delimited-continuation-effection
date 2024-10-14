import type { Operation } from "./types.ts";
import { Do } from "./control.ts";

export function suspend(): Operation<void> {
  return {
    *[Symbol.iterator]() {
      yield Do(() => {}, "suspend");
    },
  };
}
