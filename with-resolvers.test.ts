import { describe, it } from "https://deno.land/std@0.223.0/testing/bdd.ts";
import { expect } from "jsr:@std/expect";
import { evaluate, reset } from "./mod.ts";
import { withResolvers } from "./with-resolvers.ts";

describe("withResolvers", () => {
  it("allows you to resolve something for later", () => {
    let result = "pending";
    evaluate(function* () {
      let { operation, resolve } = yield* withResolvers<string>();

      yield* reset(function* () {
        result = yield* operation;
      });

      expect(result).toEqual("pending");

      yield* reset(function* () {
        resolve("hello world");
      });

      expect(result).toEqual("hello world");
    });
  });
});
