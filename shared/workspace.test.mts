import assert from "node:assert/strict";
import { test } from "node:test";
import { sourceProblem, type SourceState } from "./workspace.mjs";

const clone: SourceState = { linked: true, resolves: true, real: "/code/web", toplevel: "/code/web" };

test("sourceProblem: no link at all names the repo", () => {
  assert.match(sourceProblem("web", { linked: false, resolves: false, real: "", toplevel: "" })[0] ?? "", /web.*no source link/);
});

test("sourceProblem: a dangling link is not a clone", () => {
  assert.match(sourceProblem("web", { ...clone, resolves: false, real: "", toplevel: "" })[0] ?? "", /web.*not a git clone/);
});

test("sourceProblem: a link to a plain folder is not a clone", () => {
  assert.match(sourceProblem("web", { ...clone, toplevel: "" })[0] ?? "", /web.*not a git clone/);
});

test("sourceProblem: a link into a subfolder of a clone is not a clone", () => {
  assert.match(sourceProblem("web", { ...clone, real: "/code/web/src" })[0] ?? "", /web.*not a git clone/);
});

test("sourceProblem: a link to a clone's root is fine", () => {
  assert.deepEqual(sourceProblem("web", clone), []);
});
