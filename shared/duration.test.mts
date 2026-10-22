import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDuration } from "./duration.mjs";

test("under an hour: minutes and two-digit seconds, rounded down", () => {
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(5999), "0:05");
  assert.equal(formatDuration(107_000), "1:47");
  assert.equal(formatDuration(3_599_999), "59:59");
});

test("from an hour: hours, two-digit minutes and seconds", () => {
  assert.equal(formatDuration(3_600_000), "1:00:00");
  assert.equal(formatDuration(3_908_000), "1:05:08");
  assert.equal(formatDuration(36_000_000 + 59 * 60_000), "10:59:00");
});
