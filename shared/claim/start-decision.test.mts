import assert from "node:assert/strict";
import { test } from "node:test";
import { decideStart, pipeName, POSIX_DIR, type Attempt, type Identity } from "./start-decision.mjs";

const own: Identity = { repo: "acme/home", root: 5, startedAt: "t2" };

test("decideStart: listening holds; a dead socket file is cleared; a live run is refused", () => {
  const cases: readonly [string, Attempt<string>, string][] = [
    ["listening", { kind: "listening", holder: "h" }, "hold"],
    ["dead peer", { kind: "taken", peer: { kind: "dead" } }, "clear-stale"],
    ["live peer", { kind: "taken", peer: { kind: "live", identity: null } }, "refuse"],
  ];
  for (const [name, attempt, type] of cases) assert.equal(decideStart(attempt, own).type, type, name);
});

test("decideStart: a hold carries what the run listens with", () => {
  assert.deepEqual(decideStart({ kind: "listening", holder: "h" }, own), { type: "hold", holder: "h" });
});

test("decideStart: the refusal names repo#root, and the start time when the run answered", () => {
  const silent = decideStart({ kind: "taken", peer: { kind: "live", identity: null } }, own);
  assert.deepEqual(silent, { type: "refuse", reason: "a run is already live on acme/home#5." });
  const answered = decideStart({ kind: "taken", peer: { kind: "live", identity: { ...own, startedAt: "t1" } } }, own);
  assert.deepEqual(answered, { type: "refuse", reason: "a run is already live on acme/home#5, started t1." });
});

test("pipeName: exact per repo and root, on both platforms", () => {
  assert.equal(pipeName("acme/home", 5, "windows"), String.raw`\\.\pipe\sandcastle-factory-acme@home@5`);
  assert.equal(pipeName("acme/home", 5, "posix"), `${POSIX_DIR}/acme@home@5.sock`);
});

test("pipeName: roots and repos never share a name", () => {
  const names = [pipeName("a/b", 1, "posix"), pipeName("a/b", 11, "posix"), pipeName("a/b-1", 1, "posix"), pipeName("a-b/1", 1, "posix")];
  assert.equal(new Set(names).size, names.length);
});

test("pipeName: a POSIX path over 100 characters throws, a Windows pipe does not", () => {
  const long = `acme/${"x".repeat(80)}`;
  assert.throws(() => pipeName(long, 1, "posix"), /longer than 100/);
  assert.doesNotThrow(() => pipeName(long, 1, "windows"));
});

test("pipeName: a POSIX path of exactly 100 characters is allowed, 101 is not", () => {
  const at = (length: number) => pipeName(`a/${"x".repeat(length)}`, 1, "posix");
  assert.equal(at(67).length, 100);
  assert.throws(() => at(68), /longer than 100/);
});
