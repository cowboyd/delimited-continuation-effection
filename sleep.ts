import { action } from "./action.ts";
import type { Operation } from "./types.ts";

export function sleep(duration: number): Operation<void> {
  return action((resolve) => {
    let timeoutId = setTimeout(resolve, duration);
    return () => {
      clearTimeout(timeoutId);
    };
  });
}
