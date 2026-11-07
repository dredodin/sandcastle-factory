import assert from "node:assert/strict";
import { test } from "node:test";
import { PrOutputError, prUrl } from "./pr-output.mjs";

test("good output gives the url", () => {
  assert.equal(prUrl('<pull-request>{"url":"https://github.com/o/r/pull/1"}</pull-request>', "r"), "https://github.com/o/r/pull/1");
});

test("a missing tag throws a PrOutputError naming the repo", () => {
  assert.throws(() => prUrl("done", "r"), (error) => error instanceof PrOutputError && /PR output of r/.test(error.message));
});
