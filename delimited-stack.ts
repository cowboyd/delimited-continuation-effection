import { Err, Ok, Result } from "./result.ts";

export class DelimitedStack {
  delimiters: Result<unknown>[] = [];

  pushDelimiter(): void {
    this.delimiters.push(Ok());
  }

  popDelimiter(): Result<unknown> {
    let value = this.delimiters.pop();
    if (!value) {
      let error = new Error(`tried to exit a not existent stack delimitation`);
      error.name = `DelimitedStackError`;
      return Err(error);
    }
    return value;
  }

  setDelimiterExitResult(result: Result<unknown>): Result<unknown> {
    let current = this.delimiters.pop();
    if (!current) {
      let error = new Error(
        `There must be a stack delimitation in order to set its exit value`,
      );
      error.name = `DelimitedStackError`;
      this.delimiters.push(Err(error));
    } else {
      this.delimiters.push(result);
    }
    return this.delimiters[this.delimiters.length - 1];
  }
}
