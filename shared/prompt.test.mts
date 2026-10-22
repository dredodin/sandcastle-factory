import assert from "node:assert/strict";
import { test } from "node:test";
import { fillPrompt } from "./prompt.mjs";

test("fillPrompt: every placeholder takes its value, as often as it appears", () => {
  assert.equal(fillPrompt("Root #{{ROOT}} in {{HOME_SLUG}}; again #{{ROOT}}.", { ROOT: "42", HOME_SLUG: "o/hub" }), "Root #42 in o/hub; again #42.");
});

test("fillPrompt: a placeholder without a value throws", () => {
  assert.throws(() => fillPrompt("Root #{{ROOT}}", {}), /ROOT/);
});
