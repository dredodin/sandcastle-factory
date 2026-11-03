import assert from "node:assert/strict";
import { test } from "node:test";
import { decideStart, decideTie, parsePorts, type Identity, type Probe } from "./claim.mjs";

const own: Identity = { repo: "acme/home", root: 5, startedAt: "t2" };
const free = (port: number): Probe => ({ kind: "free", port });
const foreign = (port: number): Probe => ({ kind: "foreign", port });
const run = (port: number, root: number, repo = "acme/home"): Probe => ({ kind: "run", port, identity: { repo, root, startedAt: "t1" } });

test("decideStart: free pool starts on the first free port", () => {
  assert.deepEqual(decideStart([foreign(1), free(2), free(3)], own), { type: "start", port: 2 });
});

test("decideStart: same root live is refused, naming the run", () => {
  const claim = decideStart([free(1), run(2, 5)], own);
  assert.equal(claim.type, "refuse");
  assert.match(claim.type === "refuse" ? claim.reason : "", /acme\/home#5 since t1 on port 2/);
});

test("decideStart: another root, or the same number in another repo, still starts", () => {
  assert.deepEqual(decideStart([run(1, 6), run(2, 5, "acme/other"), free(3)], own), { type: "start", port: 3 });
});

test("decideStart: a foreign port is skipped", () => {
  assert.deepEqual(decideStart([foreign(1), free(2)], own), { type: "start", port: 2 });
});

test("decideStart: all busy is refused, listing every holder", () => {
  const claim = decideStart([run(1, 6), foreign(2)], own);
  assert.equal(claim.type, "refuse");
  const reason = claim.type === "refuse" ? claim.reason : "";
  assert.match(reason, /acme\/home#6/);
  assert.match(reason, /port 2 is held by another program/);
  assert.match(reason, /all 2 factory ports are busy: .*; port 2/);
});

test("decideTie: the run on the lower port keeps running, the higher releases", () => {
  const tie = decideTie([run(1, 5), run(2, 5)], own, 2);
  assert.equal(tie.type, "refuse");
  assert.match(tie.type === "refuse" ? tie.reason : "", /at the same time: acme\/home#5 since t1 on port 1/);
  assert.deepEqual(decideTie([run(1, 5), run(2, 5)], own, 1), { type: "start", port: 1 });
});

test("decideTie: no rival, or a rival on another root, keeps the port", () => {
  assert.deepEqual(decideTie([run(1, 5)], own, 1), { type: "start", port: 1 });
  assert.deepEqual(decideTie([run(1, 6), run(2, 5)], own, 2), { type: "start", port: 2 });
});

test("parsePorts: lists and ranges", () => {
  assert.deepEqual(parsePorts("100-102, 200"), [100, 101, 102, 200]);
  assert.deepEqual(parsePorts("5,5"), [5]);
});

test("parsePorts: bad input throws", () => {
  for (const bad of ["", "a", "5-3", "0", "70000", "1-", "1-2-3"]) assert.throws(() => parsePorts(bad));
});

test("parsePorts: spaces around parts and range ends are fine; the edges 1 and 65535 are ports", () => {
  assert.deepEqual(parsePorts(" 7 - 8 "), [7, 8]);
  assert.deepEqual(parsePorts("1,65535"), [1, 65535]);
});

test("parsePorts: errors name the offender", () => {
  assert.throws(() => parsePorts("5, x "), { message: '"x" is no port or port range' });
  assert.throws(() => parsePorts("5,70000"), { message: "a port is outside 1-65535" });
  assert.throws(() => parsePorts("0,5"), { message: "a port is outside 1-65535" });
  assert.throws(() => parsePorts("65536"), { message: "a port is outside 1-65535" });
});
