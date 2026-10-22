import assert from "node:assert/strict";
import { test } from "node:test";
import { inParallel } from "./parallel.mjs";

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

test("results come back in item order when items finish out of order", async () => {
  const releases: Array<() => void> = [];
  const run = inParallel(["a", "b", "c"], String, (item) => new Promise<string>((resolve) => releases.push(() => resolve(`done-${item}`))));
  await flush();
  releases.reverse().forEach((release) => release());
  assert.deepEqual(await run, ["done-a", "done-b", "done-c"]);
});

test("results come back in item order when a worker runs several items", async () => {
  const releases = new Map<string, () => void>();
  const run = inParallel(["a", "b", "c", "d", "e"], String, (item) => new Promise<string>((resolve) => releases.set(item, () => resolve(`done-${item}`))));
  await flush();
  releases.get("b")?.();
  await flush();
  ["a", "c", "d", "e"].forEach((item) => releases.get(item)?.());
  assert.deepEqual(await run, ["done-a", "done-b", "done-c", "done-d", "done-e"]);
});

test("a failing item does not stop the others, and the error names every failed item", async () => {
  const finished: string[] = [];
  const work = async (item: string): Promise<void> => {
    if (item.startsWith("bad")) throw new Error("boom");
    finished.push(item);
  };
  await assert.rejects(
    inParallel(["bad1", "ok1", "bad2", "ok2", "ok3", "ok4", "ok5"], (item) => item, work),
    (error: Error) => error.message === "Failed items:\n  bad1: boom\n  bad2: boom",
  );
  assert.deepEqual(finished.sort(), ["ok1", "ok2", "ok3", "ok4", "ok5"]);
});

test("no more than 4 items start before one finishes", async () => {
  let started = 0;
  const releases: Array<() => void> = [];
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const run = inParallel(items, String, () => {
    started += 1;
    return new Promise<void>((resolve) => releases.push(resolve));
  });
  await flush();
  assert.ok(started <= 4);
  while (releases.length > 0) {
    releases.shift()?.();
    await flush();
  }
  await run;
});
