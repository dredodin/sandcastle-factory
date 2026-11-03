import assert from "node:assert/strict";
import { test } from "node:test";
import type { Handled } from "./comments.mjs";
import type { Item } from "./item.mjs";
import { cycleEnds, openRecord, rejectedText, reportsText } from "./record.mjs";

test("rejections accumulate over the run", () => {
  const record = openRecord();
  record.reject([{ repo: "app", finding: "a", reason: "r1" }]);
  record.reject([{ repo: "lib", finding: "b", reason: "r2" }]);
  assert.deepEqual(record.rejected().map((r) => r.finding), ["a", "b"]);
});

test("a comment handled again replaces its earlier entry", () => {
  const record = openRecord();
  const comment: Handled = { id: "c1", pr: "p", url: "u", kind: "thread", decision: "needs info", text: "which?", branch: "" };
  record.handle([comment, { ...comment, id: "c2" }]);
  record.handle([{ ...comment, decision: "planned", text: "", branch: "b-work-1" }]);
  assert.deepEqual(record.handled().map(({ id, decision }) => `${id} ${decision}`), ["c2 needs info", "c1 planned"]);
});

test("entries carry the pass whose reports the plan worked from; cleared reports leave the pass", () => {
  const record = openRecord();
  record.reject([{ repo: "app", finding: "a", reason: "r" }]);
  record.addPass(new Map([["app", "- x"]]));
  record.clearReports();
  record.reject([{ repo: "app", finding: "b", reason: "r" }]);
  assert.deepEqual(record.review().rejected.map(({ finding, pass }) => `${finding} ${pass}`), ["a 0", "b 1"]);
  assert.equal(record.reports().size, 0);
  assert.equal(record.review().passes.length, 1);
});

const item = (branch: string): Item => ({ issue: "", work: "w", source: "review", repo: "app", title: "t", branch });

test("cycleEnds: committed and kept is merged; left out is a merge conflict; no commits ends with its outcome", () => {
  const [kept, conflict, done, stuck] = [item("a"), item("b"), item("c"), item("d")];
  const ends = cycleEnds(
    [
      { item: kept, outcome: "committed" },
      { item: conflict, outcome: "committed" },
      { item: done, outcome: "already done" },
      { item: stuck, outcome: "cannot finish" },
    ],
    [conflict],
  );
  assert.deepEqual(ends.merged, [kept]);
  assert.deepEqual(ends.ended, [
    { item: conflict, end: "merge conflict" },
    { item: done, end: "already done" },
    { item: stuck, end: "cannot finish" },
  ]);
});

test("reports text lists only repos with findings", () => {
  assert.equal(reportsText(new Map([["app", ""], ["lib", "- x"]])), "### lib\n\n- x");
  assert.equal(reportsText(new Map([["app", ""]])), "(none)");
});

test("rejected text gives each finding its reason", () => {
  assert.equal(rejectedText([]), "(none)");
  assert.equal(rejectedText([{ repo: "app", finding: "f", reason: "ADR-0001" }]), "- app: f — rejected: ADR-0001");
});
