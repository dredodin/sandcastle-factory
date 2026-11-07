import assert from "node:assert/strict";
import { test } from "node:test";
import { appFolders, sourceProblem } from "./workspace.mjs";

test("sourceProblem: no link at all names the repo", () => {
  assert.match(sourceProblem("web", false, false, false) ?? "", /web.*no source link/);
});

test("sourceProblem: a dangling link is not a clone", () => {
  assert.match(sourceProblem("web", false, true, false) ?? "", /web.*not a git clone/);
});

test("sourceProblem: a link to a plain folder is not a clone", () => {
  assert.match(sourceProblem("web", true, true, false) ?? "", /web.*not a git clone/);
});

test("sourceProblem: a link to a clone is fine", () => {
  assert.equal(sourceProblem("web", true, true, true), undefined);
});

test("appFolders: drops the home repo's folder and sorts", () => {
  assert.deepEqual(appFolders(["web", "home", "api"], "home"), ["api", "web"]);
});
