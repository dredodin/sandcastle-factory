import assert from "node:assert/strict";
import { test } from "node:test";
import { missingOutcome, outcomeEvent, reconcile } from "./outcome.mjs";

test("outcomeEvent: committed merges first, the rest map to their event", () => {
  assert.equal(outcomeEvent("committed"), null);
  assert.equal(outcomeEvent("done without code"), "doneWithoutCode");
  assert.equal(outcomeEvent("already done"), "alreadyDone");
  assert.equal(outcomeEvent("findings rejected"), "findingsRejected");
  assert.equal(outcomeEvent("cannot finish"), "cannotFinish");
});

test("missingOutcome: commits mean committed, none mean cannot finish", () => {
  assert.deepEqual(missingOutcome(2), { outcome: "committed", note: "" });
  assert.deepEqual(missingOutcome(0), { outcome: "cannot finish", note: "The implement run ended with no commits and reported no outcome." });
});

test("reconcile: committed without a commit cannot finish; code reported as none is merged; the rest stands", () => {
  assert.deepEqual(reconcile({ outcome: "committed", note: "" }, 0), { outcome: "cannot finish", note: "The implement run reported committed but made no commit." });
  assert.equal(reconcile({ outcome: "committed", note: "" }, 1).outcome, "committed");
  assert.deepEqual(reconcile({ outcome: "already done", note: "abc" }, 1), { outcome: "committed", note: "abc" });
  assert.deepEqual(reconcile({ outcome: "done without code", note: "abc" }, 1), { outcome: "committed", note: "abc" });
  assert.equal(reconcile({ outcome: "findings rejected", note: "r" }, 1).outcome, "findings rejected");
  assert.equal(reconcile({ outcome: "done without code", note: "r" }, 0).outcome, "done without code");
  assert.equal(reconcile({ outcome: "cannot finish", note: "x" }, 2).outcome, "cannot finish");
});
