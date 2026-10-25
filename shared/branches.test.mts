import assert from "node:assert/strict";
import { test } from "node:test";
import { assertNoOpenTake, freeItemBranch, isTakeBranch, nextTakeBranch, pickLatestTake, runFolderName } from "./branches.mjs";

test("nextTakeBranch: no takes gives take 1", () => {
  assert.equal(nextTakeBranch({ home: "hub", root: 42 }, new Set(["main"])), "sandcastle/hub/issue-42-take-1");
});

test("nextTakeBranch: one past the highest take", () => {
  const refs = new Set(["sandcastle/hub/issue-42-take-1", "sandcastle/hub/issue-42-take-3"]);
  assert.equal(nextTakeBranch({ home: "hub", root: 42 }, refs), "sandcastle/hub/issue-42-take-4");
});

test("nextTakeBranch: takes of another root or another home do not count", () => {
  assert.equal(nextTakeBranch({ home: "hub", root: 42 }, new Set(["sandcastle/hub/issue-4-take-7"])), "sandcastle/hub/issue-42-take-1");
  assert.equal(nextTakeBranch({ home: "hub", root: 4 }, new Set(["sandcastle/hub/issue-42-take-7"])), "sandcastle/hub/issue-4-take-1");
  assert.equal(nextTakeBranch({ home: "hub", root: 42 }, new Set(["sandcastle/other/issue-42-take-7"])), "sandcastle/hub/issue-42-take-1");
});

test("nextTakeBranch: a dot in the home name is literal", () => {
  assert.equal(nextTakeBranch({ home: "a.b", root: 1 }, new Set(["sandcastle/aXb/issue-1-take-5"])), "sandcastle/a.b/issue-1-take-1");
});

test("isTakeBranch: own takes only", () => {
  assert.equal(isTakeBranch({ home: "hub", root: 42 }, "sandcastle/hub/issue-42-take-2"), true);
  assert.equal(isTakeBranch({ home: "hub", root: 42 }, "sandcastle/hub/issue-4-take-2"), false);
  assert.equal(isTakeBranch({ home: "hub", root: 4 }, "sandcastle/hub/issue-42-take-2"), false);
  assert.equal(isTakeBranch({ home: "hub", root: 42 }, "sandcastle/issue-42-take-2"), false);
});

test("isTakeBranch: a home name with regex characters matches itself", () => {
  assert.equal(isTakeBranch({ home: "my.hub", root: 42 }, "sandcastle/my.hub/issue-42-take-1"), true);
});

test("freeItemBranch: base name when free, then -2, then -3", () => {
  const take = "sandcastle/hub/issue-42-take-1";
  assert.equal(freeItemBranch(take, "7", new Set()), "sandcastle/hub/issue-42-take-1-7");
  assert.equal(freeItemBranch(take, "7", new Set(["sandcastle/hub/issue-42-take-1-7"])), "sandcastle/hub/issue-42-take-1-7-2");
  assert.equal(
    freeItemBranch(take, "7", new Set(["sandcastle/hub/issue-42-take-1-7", "sandcastle/hub/issue-42-take-1-7-2"])),
    "sandcastle/hub/issue-42-take-1-7-3",
  );
});

const pr = (n: number, take: number) => ({ url: `https://x/pull/${n}`, headRefName: `sandcastle/hub/issue-${n}-take-${take}` });
const other = { url: "https://x/pull/9", headRefName: "feature/x" };

const refs = (...names: string[]) => new Set(names);

test("pickLatestTake: highest take number wins, repos are those with that branch", () => {
  const picked = pickLatestTake({ home: "hub", root: 42 }, [
    { repo: "hub", refs: refs("main", "sandcastle/hub/issue-42-take-1", "sandcastle/hub/issue-42-take-2") },
    { repo: "app", refs: refs("sandcastle/hub/issue-42-take-2") },
    { repo: "lib", refs: refs("sandcastle/hub/issue-42-take-1") },
  ]);
  assert.deepEqual(picked, { branch: "sandcastle/hub/issue-42-take-2", repos: ["hub", "app"] });
});

test("pickLatestTake: a take found in one repo only is enough", () => {
  const picked = pickLatestTake({ home: "hub", root: 42 }, [{ repo: "hub", refs: refs("main") }, { repo: "app", refs: refs("sandcastle/hub/issue-42-take-3") }]);
  assert.deepEqual(picked, { branch: "sandcastle/hub/issue-42-take-3", repos: ["app"] });
});

test("pickLatestTake: no take branch throws and says to run take", () => {
  assert.throws(() => pickLatestTake({ home: "hub", root: 42 }, [{ repo: "hub", refs: refs("main", "feature/x") }]), /Run `take`/);
});

test("pickLatestTake: other roots' branches and item branches of a take do not count", () => {
  const key = { home: "hub", root: 42 };
  const all = [{ repo: "hub", refs: refs("sandcastle/hub/issue-4-take-9", "sandcastle/hub/issue-420-take-9", "sandcastle/hub/issue-42-take-1-7", "sandcastle/hub/issue-42-take-1") }];
  assert.deepEqual(pickLatestTake(key, all), { branch: "sandcastle/hub/issue-42-take-1", repos: ["hub"] });
  assert.deepEqual(pickLatestTake({ home: "hub", root: 4 }, all), { branch: "sandcastle/hub/issue-4-take-9", repos: ["hub"] });
});

test("assertNoOpenTake: no take PRs passes", () => {
  assert.doesNotThrow(() => assertNoOpenTake({ home: "hub", root: 42 }, [{ repo: "hub", prs: [] }]));
});

test("assertNoOpenTake: an open take PR in any repo throws naming its URL", () => {
  assert.throws(() => assertNoOpenTake({ home: "hub", root: 42 }, [{ repo: "hub", prs: [] }, { repo: "app", prs: [pr(42, 1)] }]), /https:\/\/x\/pull\/42/);
  assert.throws(
    () => assertNoOpenTake({ home: "hub", root: 42 }, [{ repo: "hub", prs: [pr(42, 1)] }, { repo: "app", prs: [{ ...pr(42, 1), url: "https://x/pull/5" }] }]),
    (e: Error) => e.message.includes("  https://x/pull/42\n  https://x/pull/5"),
  );
});

test("assertNoOpenTake: other roots' take PRs and non-take branches are ignored", () => {
  assert.doesNotThrow(() => assertNoOpenTake({ home: "hub", root: 42 }, [{ repo: "hub", prs: [pr(4, 1), pr(420, 1), other] }]));
});

test("runFolderName: take carries the branch's take number", () => {
  assert.equal(runFolderName("take", { home: "hub", root: 42 }, "sandcastle/hub/issue-42-take-3", []), "issue-42-take-3");
});

test("runFolderName: first resume is 1", () => {
  assert.equal(runFolderName("resume", { home: "hub", root: 42 }, "sandcastle/hub/issue-42-take-3", ["issue-42-take-3"]), "issue-42-resume-1");
});

test("runFolderName: resume is one past the highest, gaps and other issues ignored", () => {
  const existing = ["issue-42-resume-1", "issue-42-resume-4", "issue-4-resume-9", "issue-142-resume-8", "issue-42-resume-x", "issue-42-resume-"];
  assert.equal(runFolderName("resume", { home: "hub", root: 42 }, "sandcastle/hub/issue-42-take-3", existing), "issue-42-resume-5");
  assert.equal(runFolderName("resume", { home: "hub", root: 4 }, "sandcastle/hub/issue-4-take-1", existing), "issue-4-resume-10");
});
