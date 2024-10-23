import { Operation } from "./types.ts";
import { action } from "./action.ts";

export function sleep(duration: number): Operation<void> {
  return action((resolve) => {
    let timeoutId = setTimeout(resolve, duration);
    return () => clearTimeout(timeoutId);
  }, `sleep(${duration})`);
}
