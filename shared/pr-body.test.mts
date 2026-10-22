import assert from "node:assert/strict";
import { test } from "node:test";
import { blockersFromJson, closesLines, closesRoot, mergeOrder, prRef, reposWithoutPr, runBlock, withRunBlock, type Pr } from "./pr-body.mjs";

const hub: Pr = { repo: "hub", url: "https://github.com/acme/hub/pull/9", issues: [3] };
const app: Pr = { repo: "app", url: "https://github.com/acme/app/pull/12", issues: [4, 5] };
const lib: Pr = { repo: "lib", url: "https://github.com/acme/lib/pull/2", issues: [6] };

test("closesLines: one line per issue, naming the home repo", () => {
  assert.equal(closesLines("acme/hub", [7, 3]), "Closes acme/hub#7\nCloses acme/hub#3");
});

test("closesRoot: only the home repo's PR, unless the run has no home PR", () => {
  assert.equal(closesRoot("hub", "hub", ["hub", "app"]), true);
  assert.equal(closesRoot("app", "hub", ["hub", "app"]), false);
  assert.equal(closesRoot("app", "hub", ["app", "lib"]), true);
});

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
});

test("mergeOrder: chains resolve, blockers outside the run and inside one PR are ignored", () => {
  assert.deepEqual(mergeOrder([hub, app, lib], { 3: [6], 6: [4], 4: [5], 5: [99] }), [app, lib, hub]);
});

test("mergeOrder: a cycle keeps the given order", () => {
  assert.deepEqual(mergeOrder([hub, app], { 3: [4], 4: [3] }), [hub, app]);
});

test("runBlock: empty for a single PR with nothing left out", () => {
  assert.equal(runBlock("acme/hub", 7, [hub], [], {}), "");
});

test("runBlock: PR list in merge order, and the repo without a PR with its open issues", () => {
  const block = runBlock("acme/hub", 7, [hub, app], [{ repo: "lib", open: [6, 8] }], { 3: [5] });
  assert.equal(
    block,
    [
      "<!-- sandcastle-run -->",
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

test("reposWithoutPr: repos with planned work and no PR, with their issue items once each", () => {
  const planned = [
    { repo: "hub", issue: "3", comments: [] },
    { repo: "lib", issue: "6", comments: [] },
    { repo: "lib", issue: "7", comments: ["https://github.com/acme/lib/pull/2#issuecomment-1"] },
    { repo: "lib", issue: "6", comments: [] },
    { repo: "web", issue: "8", comments: [] },
  ];
  assert.deepEqual(reposWithoutPr(planned, ["hub", "web"]), [{ repo: "lib", open: [6] }]);
});

test("reposWithoutPr: a repo without planned work is never listed", () => {
  assert.deepEqual(reposWithoutPr([{ repo: "app", issue: "4", comments: [] }], ["app"]), []);
});

test("withRunBlock: appends once, then replaces its own earlier block", () => {
  const first = withRunBlock("Body\n\nCloses acme/hub#7", "<!-- sandcastle-run -->\nA\n<!-- /sandcastle-run -->");
  assert.equal(first, "Body\n\nCloses acme/hub#7\n\n<!-- sandcastle-run -->\nA\n<!-- /sandcastle-run -->\n");
  const second = withRunBlock(first, "<!-- sandcastle-run -->\nB\n<!-- /sandcastle-run -->");
  assert.equal(second, "Body\n\nCloses acme/hub#7\n\n<!-- sandcastle-run -->\nB\n<!-- /sandcastle-run -->\n");
});

test("withRunBlock: an empty block removes the old one", () => {
  assert.equal(withRunBlock("Body\n\n<!-- sandcastle-run -->\nA\n<!-- /sandcastle-run -->\n", ""), "Body");
});
