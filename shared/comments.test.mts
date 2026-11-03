import assert from "node:assert/strict";
import { test } from "node:test";
import { handledOf, handledText, replyOf, type Handled, type PlanComment } from "./comments.mjs";
import { DISCLAIMER } from "./run.mjs";

const pr = "https://github.com/o/app/pull/5";
const base: Handled = { id: "c1", pr, url: `${pr}#discussion_r1`, kind: "thread", decision: "planned", text: "", branch: "b-work-1" };
const commits = new Map([["b-work-1", "abc1234"]]);

test("a planned comment is answered with its merge commit and resolved", () => {
  const reply = replyOf(base, commits);
  assert.equal(reply?.body, `${DISCLAIMER}\n\nfixed in abc1234`);
  assert.equal(reply?.resolve, true);
});

test("a planned comment whose item has no merge commit gets no reply", () => {
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

test("a top-level comment or review body is answered with a link to it", () => {
  const review = { ...base, kind: "review", url: `${pr}#pullrequestreview-9` } as const;
  assert.equal(replyOf(review, commits)?.body, `${DISCLAIMER}\n\nRe ${pr}#pullrequestreview-9\n\nfixed in abc1234`);
  assert.equal(replyOf({ ...review, kind: "comment", decision: "won't do", text: "no" }, commits)?.body, `${DISCLAIMER}\n\nRe ${pr}#pullrequestreview-9\n\nno`);
});

const fields = { pr, url: `${pr}#c`, kind: "comment" } as const;

test("handledOf: a planned comment takes its item's branch, others none", () => {
  const comments: readonly PlanComment[] = [
    { ...fields, id: "a", decision: "planned", item: 2 },
    { ...fields, id: "b", decision: "won't do", text: "r" },
    { ...fields, id: "c", decision: "needs info", text: "q?" },
  ];
  assert.deepEqual(handledOf(comments, [{ position: 1, branch: "b1" }, { position: 2, branch: "b2" }]), [
    { ...fields, id: "a", decision: "planned", text: "", branch: "b2" },
    { ...fields, id: "b", decision: "won't do", text: "r", branch: "" },
    { ...fields, id: "c", decision: "needs info", text: "q?", branch: "" },
  ]);
});

test("handledOf: a planned comment whose item was not taken is dropped", () => {
  assert.deepEqual(handledOf([{ ...fields, id: "a", decision: "planned", item: 2 }], [{ position: 1, branch: "b1" }]), []);
});

test("handled text lists each comment", () => {
  assert.equal(handledText([]), "(none)");
  assert.match(handledText([{ ...base, decision: "needs info", text: "q" }]), /discussion_r1 \(thread c1\): needs info — q/);
});
