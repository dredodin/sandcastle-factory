import assert from "node:assert/strict";
import { test } from "node:test";
import { hasIssue, implementRunOf, itemFits, itemId, planItemSchema, type Item } from "./item.mjs";

const home = { name: "hub", slug: "acme/hub" };
const context = { home, otherBranches: "- app: sandcastle/hub/issue-7-take-1" };
const full = (issue: string, repo = "hub"): Item => ({ issue, work: "", repo, title: "t", branch: "b" });

const planned = { repo: "app", title: "t" };

test("planItemSchema: an issue item", () => {
  assert.deepEqual(planItemSchema.parse({ ...planned, issue: "42" }), { ...planned, issue: "42", work: "" });
});

test("planItemSchema: a work item", () => {
  assert.deepEqual(planItemSchema.parse({ ...planned, work: "fix a.ts" }), { ...planned, issue: "", work: "fix a.ts" });
});

test("planItemSchema: both issue and work are rejected", () => {
  assert.throws(() => planItemSchema.parse({ ...planned, issue: "42", work: "fix a.ts" }));
});

test("planItemSchema: neither issue nor work is rejected", () => {
  assert.throws(() => planItemSchema.parse(planned));
  assert.throws(() => planItemSchema.parse({ ...planned, issue: "", work: "" }));
});

test("planItemSchema: a malformed issue number is rejected", () => {
  assert.throws(() => planItemSchema.parse({ ...planned, issue: "0" }));
});

test("implementRunOf: issue item in the home repo", () => {
  assert.deepEqual(implementRunOf({ ...full("42"), title: "Fix", branch: "br" }, { number: 3, root: 7 }, context), {
    promptArgs: {
      WORK: "https://github.com/acme/hub/issues/42",
      ISSUE: "42",
      TITLE: "Fix",
      ROOT: "7",
      BRANCH: "br",
      DISCLAIMER: "> *Sandcastle agent reply — not a request.*",
      HOME_SLUG: "acme/hub",
      REPO_NAME: "hub",
      VERIFY: "bash .sandcastle/repos/hub/verify.sh",
      OTHER_BRANCHES: "- app: sandcastle/hub/issue-7-take-1",
      READ: "Read the issue whole. Issues live in `acme/hub`; you work in the repo `hub`, the one checked out here: `gh issue view 42 --repo acme/hub --json number,title,body,labels,comments`. Comments starting `> *Sandcastle agent reply — not a request.*` are the agent's own.",
      REPORT: "comments the note on #42 and moves the card",
    },
    name: "implement 42",
    logName: "3-42-implement",
  });
});

test("implementRunOf: an app repo's issue is read from the home repo and its log carries the repo", () => {
  const inputs = implementRunOf(full("42", "app"), { number: 1, root: 7 }, context);
  assert.equal(inputs.promptArgs["WORK"], "https://github.com/acme/hub/issues/42");
  assert.equal(inputs.promptArgs["VERIFY"], "bash .sandcastle/repos/app/verify.sh");
  assert.equal(inputs.logName, "1-42-implement-app");
});

const work: Item = { issue: "", work: "Fix a.ts:3", repo: "app", title: "Fix check", branch: "int-work-2-3" };

test("implementRunOf: a work item gets its text, the root as issue, and names from its branch", () => {
  const inputs = implementRunOf(work, { number: 4, root: 7 }, context);
  assert.equal(inputs.promptArgs["WORK"], "Fix a.ts:3");
  assert.equal(inputs.promptArgs["ISSUE"], "7");
  assert.equal(inputs.promptArgs["VERIFY"], "bash .sandcastle/repos/app/verify.sh");
  assert.equal(inputs.name, "implement work-2-3");
  assert.equal(inputs.logName, "4-work-2-3-implement-app");
});

test("itemId: the issue number, else the work suffix of the branch", () => {
  assert.equal(itemId(full("42")), "42");
  assert.equal(itemId(work), "work-2-3");
  assert.equal(hasIssue(work), false);
  assert.equal(hasIssue(full("42")), true);
});

const repos = [home, { name: "app", slug: "acme/app" }];

test("itemFits: a repo of the Workspace fits, an unknown one does not", () => {
  assert.equal(itemFits({ repo: "hub" }, repos), true);
  assert.equal(itemFits({ repo: "app" }, repos), true);
  assert.equal(itemFits({ repo: "web" }, repos), false);
});
