import assert from "node:assert/strict";
import { test } from "node:test";
import { blockersFromJson, mergeOrder, modelsLine, prRef, reposWithoutPr, runBlock, withRunBlock, type Pr } from "./pr-body.mjs";

const hub: Pr = { repo: "hub", url: "https://github.com/acme/hub/pull/9", issues: [3] };
const app: Pr = { repo: "app", url: "https://github.com/acme/app/pull/12", issues: [4, 5] };
const lib: Pr = { repo: "lib", url: "https://github.com/acme/lib/pull/2", issues: [6] };

test("blockersFromJson: numbers of gh's blockedBy nodes", () => {
  assert.deepEqual(blockersFromJson('{"blockedBy":{"nodes":[{"number":4},{"number":9}],"totalCount":2}}'), [4, 9]);
  assert.deepEqual(blockersFromJson('{"blockedBy":{"nodes":[],"totalCount":0}}'), []);
  assert.throws(() => blockersFromJson('{"blockedBy":[{"number":4}]}'));
});

test("prRef: owner/repo#n from a PR URL", () => {
  assert.equal(prRef("https://github.com/acme/app/pull/12"), "acme/app#12");
  assert.equal(prRef("https://example.com/x"), "https://example.com/x");
});

test("mergeOrder: no blocking keeps the order", () => {
  assert.deepEqual(mergeOrder([hub, app, lib], {}), [hub, app, lib]);
});

test("mergeOrder: a blocked issue's PR comes after its blocker's PR", () => {
  assert.deepEqual(mergeOrder([hub, app], { 3: [5] }), [app, hub]);
  assert.deepEqual(mergeOrder([hub, app], { 3: [99, 5] }), [app, hub]);
});

test("mergeOrder: chains resolve, blockers outside the run and inside one PR are ignored", () => {
  assert.deepEqual(mergeOrder([hub, app, lib], { 3: [6], 6: [4], 4: [5], 5: [99] }), [app, lib, hub]);
});

test("mergeOrder: a cycle keeps the given order", () => {
  assert.deepEqual(mergeOrder([hub, app], { 3: [4], 4: [3] }), [hub, app]);
});

test("modelsLine: every phase's model, provider and effort, in phase order", () => {
  const claude = { provider: "claudeCode", model: "opus", effort: "high" } as const;
  assert.equal(
    modelsLine({ PR: claude, PLAN: claude, MERGE: claude, REVIEW: claude, IMPLEMENT: { provider: "copilot", model: "gpt-5.5", effort: "low" } }),
    "Models: PLAN `opus` (claudeCode, high), IMPLEMENT `gpt-5.5` (copilot, low), REVIEW `opus` (claudeCode, high), MERGE `opus` (claudeCode, high), PR `opus` (claudeCode, high).",
  );
});

test("runBlock: only the models line for a single PR with nothing left out", () => {
  assert.equal(runBlock("Models: m.", "acme/hub", 7, [hub], [], {}, []), "<!-- sandcastle-run -->\nModels: m.\n<!-- /sandcastle-run -->");
});

test("runBlock: PR list in merge order, and the repo without a PR with its open issues", () => {
  const block = runBlock("Models: m.", "acme/hub", 7, [hub, app], [{ repo: "lib", open: [6, 8] }], { 3: [5] }, []);
  assert.equal(
    block,
    [
      "<!-- sandcastle-run -->",
      "Models: m.",
      "",
      "## Run",
      "",
      "One change over several repos, root acme/hub#7. Merge in this order:",
      "",
      "1. acme/app#12 (app)",
      "2. acme/hub#9 (hub)",
      "",
      "No PR in `lib`: no commits. Still open: #6, #8.",
      "<!-- /sandcastle-run -->",
    ].join("\n"),
  );
});

test("runBlock: several PRs with nothing left out still list the merge order", () => {
  assert.match(runBlock("Models: m.", "acme/hub", 7, [hub, app], [], {}, []), /1\. acme\/hub#9 \(hub\)\n2\. acme\/app#12 \(app\)/);
});

test("runBlock: sub-issues left in Backlog are listed, even for a single PR", () => {
  assert.equal(
    runBlock("Models: m.", "acme/hub", 7, [hub], [], {}, [4, 9]),
    "<!-- sandcastle-run -->\nModels: m.\n\n## Run\n\nLeft in Backlog, not delivered: #4, #9.\n<!-- /sandcastle-run -->",
  );
  assert.match(runBlock("Models: m.", "acme/hub", 7, [hub, app], [], {}, [4]), /2\. acme\/app#12 \(app\)\n\nLeft in Backlog, not delivered: #4\.\n</);
});

test("runBlock: no Closes line", () => assert.doesNotMatch(runBlock("Models: m.", "acme/hub", 7, [hub, app], [], {}, [4]), /Closes/));

test("reposWithoutPr: repos with planned work and no PR, with their issues once each", () => {
  const planned = [
    { repo: "hub", issue: "3" },
    { repo: "lib", issue: "6" },
    { repo: "lib", issue: "7" },
    { repo: "lib", issue: "6" },
    { repo: "web", issue: "8" },
  ];
  assert.deepEqual(reposWithoutPr(planned, ["hub", "web"]), [{ repo: "lib", open: [6, 7] }]);
});

test("reposWithoutPr: a repo without planned work is never listed", () => {
  assert.deepEqual(reposWithoutPr([{ repo: "app", issue: "4" }], ["app"]), []);
});

test("withRunBlock: appends once, then replaces its own earlier block", () => {
  const first = withRunBlock("Body\n\nFixes nothing", "<!-- sandcastle-run -->\nA\n<!-- /sandcastle-run -->");
  assert.equal(first, "Body\n\nFixes nothing\n\n<!-- sandcastle-run -->\nA\n<!-- /sandcastle-run -->\n");
  const second = withRunBlock(first, "<!-- sandcastle-run -->\nB\n<!-- /sandcastle-run -->");
  assert.equal(second, "Body\n\nFixes nothing\n\n<!-- sandcastle-run -->\nB\n<!-- /sandcastle-run -->\n");
});

test("withRunBlock: an old block amid the body is cut out, the new one goes last", () => {
  assert.equal(withRunBlock("Body\n\n<!-- sandcastle-run -->\nA\n<!-- /sandcastle-run -->\n\nTail", "B"), "Body\nTail\n\nB\n");
});
