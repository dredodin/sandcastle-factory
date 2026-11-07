import assert from "node:assert/strict";
import { test } from "node:test";
import { deepVerifyCommand, imageName, logFileName, planCheckCommand, slugFromRemote, sourceProblem } from "./names.mjs";

test("deepVerifyCommand and planCheckCommand: scripts in the repo's folder", () => {
  assert.equal(deepVerifyCommand("app", "origin/main"), "bash .sandcastle/repos/app/deep-verify.sh origin/main");
  assert.equal(planCheckCommand("hub"), "bash .sandcastle/repos/hub/plan-check.sh");
});

test("slugFromRemote: https, ssh, with and without .git", () => {
  const slug = { owner: "acme", name: "hub" };
  assert.deepEqual(slugFromRemote("https://github.com/acme/hub.git"), slug);
  assert.deepEqual(slugFromRemote("https://github.com/acme/hub"), slug);
  assert.deepEqual(slugFromRemote("git@github.com:acme/hub.git\n"), slug);
  assert.deepEqual(slugFromRemote("ssh://git@github.com/acme/hub.git"), slug);
  assert.deepEqual(slugFromRemote("https://x-access-token:abc@github.com/acme/a.b"), { owner: "acme", name: "a.b" });
});

test("slugFromRemote: another host throws", () => {
  assert.throws(() => slugFromRemote("https://gitlab.com/acme/hub.git"), /GitHub/);
});

test("imageName: home and repo, lower case", () => {
  assert.equal(imageName("hub", "app"), "sandcastle:hub-app");
  assert.equal(imageName("Hub", "App"), "sandcastle:hub-app");
});

test("logFileName: the number pads to three digits, so names sort in order", () => {
  assert.equal(logFileName(2, "implement-223", "app"), "002-implement-223-app.log");
});

test("sourceProblem: no resolving link names the repo", () => {
  assert.equal(sourceProblem("web", { resolves: false, prefix: null }), "web: no source link — run onboarding");
});

test("sourceProblem: a link to a plain folder is a problem", () => {
  assert.match(sourceProblem("web", { resolves: true, prefix: null }), /^web: no source link/);
});

test("sourceProblem: a link into a subfolder of a clone is a problem", () => {
  assert.match(sourceProblem("web", { resolves: true, prefix: "src/" }), /^web: no source link/);
});

test("sourceProblem: a link to a clone's root is fine", () => {
  assert.equal(sourceProblem("web", { resolves: true, prefix: "" }), "");
});
