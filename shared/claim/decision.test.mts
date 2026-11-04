import assert from "node:assert/strict";
import { test } from "node:test";
import { decideStart, pipePath, type Holder } from "./decision.mjs";

const run: Holder = { kind: "run", identity: { repo: "acme/home", root: 5, startedAt: "t1" } };

test("decideStart: nobody holding the pipe starts", () => {
  assert.deepEqual(decideStart({ kind: "none" }), { type: "start" });
});

test("decideStart: a live run is refused, naming it", () => {
  const claim = decideStart(run);
  assert.equal(claim.type, "refuse");
  assert.match(claim.type === "refuse" ? claim.reason : "", /acme\/home#5.*t1/);
});

test("decideStart: a foreign holder is refused", () => {
  assert.equal(decideStart({ kind: "foreign", detail: "EACCES" }).type, "refuse");
});

test("pipePath: one name per repo and root, in the pipe namespace on Windows, in tmp elsewhere", () => {
  assert.equal(pipePath("acme/home", 5, "win32", "/tmp"), "\\\\.\\pipe\\sandcastle-factory-acme%2Fhome-5");
  assert.equal(pipePath("acme/home", 5, "linux", "/tmp"), "/tmp/sandcastle-factory-acme%2Fhome-5.sock");
  assert.notEqual(pipePath("a-b/c", 1, "linux", "/t"), pipePath("a/b-c", 1, "linux", "/t"));
});
