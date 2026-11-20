import assert from "node:assert/strict";
import { test } from "node:test";
import { cappedCommits } from "./commit-list.mjs";

test("cappedCommits: a short list is whole, with no note", () => {
  assert.equal(cappedCommits(["a1 one", "b2 two"], 4000), "a1 one\nb2 two");
});

test("cappedCommits: a long list is cut, the note counts commits left out", () => {
  const lines = Array.from({ length: 500 }, (_, i) => `h${i} SANDCASTLE: subject number ${i}`);
  const text = cappedCommits(lines, 4000);
  assert.match(text, /\(list truncated: \d+ of 500 commits left out; run git log for more\)$/);
  const kept = text.split("\n").length - 1;
  assert.ok(text.includes(`${500 - kept} of 500`));
  assert.ok(text.startsWith("h0 SANDCASTLE: subject number 0\nh1 "));
});

test("cappedCommits: commit lines plus note stay within the cap", () => {
  const lines = Array.from({ length: 500 }, (_, i) => `h${i} ${"x".repeat(60)}`);
  for (const cap of [200, 1000, 4000]) assert.ok(cappedCommits(lines, cap).length <= cap);
});

test("cappedCommits: a subject is cut to 200 characters", () => {
  assert.equal(cappedCommits(["y".repeat(300)], 4000), "y".repeat(200));
});

test("cappedCommits: no commits give an empty text", () => {
  assert.equal(cappedCommits([], 4000), "");
});
