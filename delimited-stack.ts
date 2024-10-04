import { Break, Instruction, Resume } from "./control.ts";
import { Err, Ok } from "./result.ts";

export class DelimitedStack {
  delimiters: Instruction[] = [];

  pushDelimiter(): void {
    this.delimiters.push(Resume(Ok()));
  }

  popDelimiter(): Instruction {
    let value = this.delimiters.pop();
    if (!value) {
      let error = new Error(`tried to exit a not existent stack delimitation`);
      error.name = `DelimitedStackError`;
      return Resume(Err(error));
    }
    return value;
  }

  setExitWith(instruction: Instruction): Instruction {
    let current = this.delimiters.pop();
    if (!current) {
      let error = new Error(
        `There must be a stack delimitation in order to set its exit value`,
      );
      error.name = `DelimitedStackError`;
      this.delimiters.push(Resume(Err(error)));
    } else {
      this.delimiters.push(instruction);
    }
    return this.delimiters[this.delimiters.length - 1];
  }

  get haltInstruction(): Instruction {
    return this.delimiters.reduce(Break, Break(Resume(Ok())));
  }
}
