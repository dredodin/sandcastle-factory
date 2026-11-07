import assert from "node:assert/strict";
import { test } from "node:test";
import { isSlow, median, parseStats, withSample } from "./stats.mjs";

test("median: middle sample of an odd count, mean of the two middle ones of an even count", () => {
  assert.equal(median([30, 10, 20]), 20);
  assert.equal(median([40, 10, 30, 20]), 25);
});

test("isSlow: only past twice the median", () => {
  assert.equal(isSlow([10, 10, 10], 20), false);
  assert.equal(isSlow([10, 10, 10], 21), true);
});

test("isSlow: never without samples", () => {
  assert.equal(isSlow([], 1_000_000), false);
});

test("withSample: appends under its key, keeps the latest 50, leaves other keys", () => {
  const full = withSample({ "plan home": [1], "implement app": Array.from({ length: 50 }, (_, i) => i) }, "implement app", 99);
  assert.equal(full["implement app"]!.length, 50);
  assert.equal(full["implement app"]![0], 1);
  assert.equal(full["implement app"]![49], 99);
  assert.deepEqual(full["plan home"], [1]);
});

test("parseStats: rejects anything but durations per key", () => {
  assert.deepEqual(parseStats('{"plan home":[1,2]}'), { "plan home": [1, 2] });
  assert.throws(() => parseStats('{"plan home":["1"]}'));
});
