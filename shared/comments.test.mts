import assert from "node:assert/strict";
import { test } from "node:test";
import { handledText, replyOf, type Handled } from "./comments.mjs";
import { DISCLAIMER } from "./run.mjs";

const base: Handled = { id: "c1", pr: "https://github.com/o/app/pull/5", kind: "thread", decision: "planned", text: "", branch: "b-work-1" };
const commits = new Map([["b-work-1", "abc1234"]]);

test("a planned comment is answered with its merge commit and resolved", () => {
  const reply = replyOf(base, commits);
  assert.equal(reply?.body, `${DISCLAIMER}\n\nfixed in abc1234`);
  assert.equal(reply?.resolve, true);
});

test("a planned comment whose item is not merged gets no reply", () => {
  assert.equal(replyOf({ ...base, branch: "other" }, commits), null);
});

test("won't do replies with the reason and resolves", () => {
  const reply = replyOf({ ...base, decision: "won't do", text: "out of scope", branch: "" }, commits);
  assert.equal(reply?.body, `${DISCLAIMER}\n\nout of scope`);
  assert.equal(reply?.resolve, true);
});

test("needs info replies with the question and stays open", () => {
  const reply = replyOf({ ...base, decision: "needs info", text: "which flag?", branch: "" }, commits);
  assert.equal(reply?.body, `${DISCLAIMER}\n\nwhich flag?`);
  assert.equal(reply?.resolve, false);
});

test("handled text lists each comment", () => {
  assert.equal(handledText([]), "(none)");
  assert.match(handledText([{ ...base, decision: "needs info", text: "q" }]), /c1: needs info — q/);
});
