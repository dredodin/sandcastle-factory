import assert from "node:assert/strict";
import { test } from "node:test";
import { openRecord, rejectedText, reportsText } from "./record.mjs";

test("rejections accumulate over the run", () => {
  const record = openRecord();
  record.reject([{ repo: "app", finding: "a", reason: "r1" }]);
  record.reject([{ repo: "lib", finding: "b", reason: "r2" }]);
  assert.deepEqual(record.rejected().map((r) => r.finding), ["a", "b"]);
});

test("reports text lists only repos with findings", () => {
  assert.equal(reportsText(new Map([["app", ""], ["lib", "- x"]])), "### lib\n\n- x");
  assert.equal(reportsText(new Map([["app", ""]])), "(none)");
});

test("rejected text gives each finding its reason", () => {
  assert.equal(rejectedText([]), "(none)");
  assert.equal(rejectedText([{ repo: "app", finding: "f", reason: "ADR-0001" }]), "- app: f — rejected: ADR-0001");
});
