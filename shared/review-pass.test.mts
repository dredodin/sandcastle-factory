import assert from "node:assert/strict";
import { test } from "node:test";
import { afterReview } from "./review-pass.mjs";

test("pass 1 then cycles planned something: review pass 2", () => {
  assert.equal(afterReview(1, true), "review");
});

test("pass 1 then nothing planned: PR", () => {
  assert.equal(afterReview(1, false), "pr");
});

test("pass 2 then anything: PR", () => {
  assert.equal(afterReview(2, true), "pr");
  assert.equal(afterReview(2, false), "pr");
});
