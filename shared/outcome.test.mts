import assert from "node:assert/strict";
import { test } from "node:test";
import { missingOutcome, outcomeEvent, outcomeSchema, reconcile } from "./outcome.mjs";

test("outcomeEvent: committed merges first, the rest map to their event", () => {
  assert.equal(outcomeEvent("committed"), null);
  assert.equal(outcomeEvent("done without code"), "doneWithoutCode");
  assert.equal(outcomeEvent("already done"), "alreadyDone");
  assert.equal(outcomeEvent("findings rejected"), "findingsRejected");
  assert.equal(outcomeEvent("cannot finish"), "cannotFinish");
});

test("outcomeSchema: the note defaults to empty, an unknown outcome throws", () => {
  assert.deepEqual(outcomeSchema.parse({ outcome: "committed" }), { outcome: "committed", note: "" });
  assert.throws(() => outcomeSchema.parse({ outcome: "gave up" }));
});

test("missingOutcome: commits mean committed, none mean cannot finish", () => {
  assert.equal(missingOutcome(2).outcome, "committed");
  assert.equal(missingOutcome(0).outcome, "cannot finish");
});

test("reconcile: committed without a commit cannot finish; code reported as none is merged; the rest stands", () => {
  assert.equal(reconcile({ outcome: "committed", note: "" }, 0).outcome, "cannot finish");
  assert.equal(reconcile({ outcome: "committed", note: "" }, 1).outcome, "committed");
  assert.deepEqual(reconcile({ outcome: "already done", note: "abc" }, 1), { outcome: "committed", note: "abc" });
  assert.equal(reconcile({ outcome: "done without code", note: "r" }, 0).outcome, "done without code");
  assert.equal(reconcile({ outcome: "cannot finish", note: "x" }, 2).outcome, "cannot finish");
});
