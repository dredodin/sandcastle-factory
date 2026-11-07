import assert from "node:assert/strict";
import { test } from "node:test";
import { prUrl } from "./pr.mjs";

test("good output gives the url", () => {
  assert.equal(prUrl('<pull-request>{"url":"https://github.com/o/r/pull/1"}</pull-request>', "r"), "https://github.com/o/r/pull/1");
});

test("a missing tag throws naming the repo", () => {
  assert.throws(() => prUrl("done", "r"), /PR output of r missing or invalid/);
});

test("a bad url throws naming the repo", () => {
  assert.throws(() => prUrl('<pull-request>{"url":"nope"}</pull-request>', "r"), /PR output of r missing or invalid/);
});
