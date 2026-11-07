import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { sh } from "./shell.mjs";
import { sourceOf } from "./workspace.mjs";

const home = (): string => {
  const root = mkdtempSync(`${tmpdir()}/ws-`);
  mkdirSync(`${root}/.sandcastle/repos/web`, { recursive: true });
  return root;
};

test("sourceOf: no source link fails naming the repo", () => {
  assert.throws(() => sourceOf(home(), "web"), /^Error: web: no source link — run onboarding$/);
});

test("sourceOf: a link to a folder that is no git clone fails naming the repo", () => {
  const root = home();
  const plain = mkdtempSync(`${tmpdir()}/plain-`);
  symlinkSync(plain, `${root}/.sandcastle/repos/web/source`, "dir");
  assert.throws(() => sourceOf(root, "web"), /web: source link is not a git clone — run onboarding/);
});

test("sourceOf: a link to a git clone gives the clone's path", () => {
  const root = home();
  const clone = mkdtempSync(`${tmpdir()}/clone-`);
  sh(clone, "git", "init", "-q");
  symlinkSync(clone, `${root}/.sandcastle/repos/web/source`, "dir");
  assert.equal(sourceOf(root, "web"), sh(clone, "git", "rev-parse", "--show-toplevel"));
});
