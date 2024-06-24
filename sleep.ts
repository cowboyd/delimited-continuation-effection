import { suspend } from "./suspend.ts";
import type { Operation } from "./types.ts";

export function sleep(duration: number): Operation<void> {
  return suspend((resolve) => {
    let timeoutId = setTimeout(resolve, duration);
    return () => {
      clearTimeout(timeoutId);
    };
  });
}
