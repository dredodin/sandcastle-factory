import assert from "node:assert/strict";
import { test } from "node:test";
import { parseWorktrees, planClean } from "./worktrees.mjs";

const porcelain = [
  "worktree /r",
  "HEAD aaa",
  "branch refs/heads/main",
  "",
  "worktree /r/.sandcastle/worktrees/a",
  "HEAD bbb",
  "branch refs/heads/sandcastle/hub/issue-1-take-1",
  "",
  "worktree /r/.sandcastle/worktrees/b",
  "HEAD ccc",
  "branch refs/heads/sandcastle/hub/issue-2-take-1",
  "",
  "worktree /r/.sandcastle/worktrees/d",
  "HEAD ddd",
  "detached",
  "",
].join("\n");

test("parseWorktrees: path and branch, null when detached", () => {
  assert.deepEqual(parseWorktrees(porcelain).map(({ path, branch }) => [path, branch]), [
    ["/r", "main"],
    ["/r/.sandcastle/worktrees/a", "sandcastle/hub/issue-1-take-1"],
    ["/r/.sandcastle/worktrees/b", "sandcastle/hub/issue-2-take-1"],
    ["/r/.sandcastle/worktrees/d", null],
  ]);
});

test("planClean: closed roots' linked worktrees and branches; open roots untouched", () => {
  const branches = ["sandcastle/hub/issue-1-take-1", "sandcastle/hub/issue-1-take-2", "sandcastle/hub/issue-2-take-1"];
  assert.deepEqual(planClean("hub", porcelain, branches, new Set([1])), {
    worktrees: ["/r/.sandcastle/worktrees/a"],
    branches: ["sandcastle/hub/issue-1-take-1", "sandcastle/hub/issue-1-take-2"],
    kept: [],
  });
});

test("planClean: a closed branch checked out in the main tree is kept, the main tree is never removed", () => {
  const main = "worktree /r\nHEAD a\nbranch refs/heads/sandcastle/hub/issue-1-take-1\n\n";
  assert.deepEqual(planClean("hub", main, ["sandcastle/hub/issue-1-take-1", "sandcastle/hub/issue-1-take-2"], new Set([1])), {
    worktrees: [],
    branches: ["sandcastle/hub/issue-1-take-2"],
    kept: ["sandcastle/hub/issue-1-take-1"],
  });
});

test("planClean: nothing closed, nothing planned", () => {
  assert.deepEqual(planClean("hub", porcelain, ["sandcastle/hub/issue-1-take-1"], new Set()), { worktrees: [], branches: [], kept: [] });
});

test("planClean: a detached worktree is removed by its folder name when the root is closed", () => {
  const detached = (name: string) => `worktree /r/.sandcastle/worktrees/${name}\nHEAD d\ndetached\n\n`;
  const tree = `worktree /r\nHEAD a\nbranch refs/heads/main\n\n${detached("sandcastle-hub-issue-1-take-2-slug")}${detached("sandcastle-hub-issue-2-take-1")}${detached("scratch")}`;
  assert.deepEqual(planClean("hub", tree, [], new Set([1])).worktrees, ["/r/.sandcastle/worktrees/sandcastle-hub-issue-1-take-2-slug"]);
});

test("planClean: without any worktree listed, closed branches are still deleted", () => {
  assert.deepEqual(planClean("hub", "", ["sandcastle/hub/issue-1-take-1"], new Set([1])), { worktrees: [], branches: ["sandcastle/hub/issue-1-take-1"], kept: [] });
});

test("parseWorktrees: a block that is not a worktree is skipped", () => {
  assert.deepEqual(parseWorktrees("junk\n\nworktree /a\nHEAD x\n\n"), [{ path: "/a", branch: null }]);
});
