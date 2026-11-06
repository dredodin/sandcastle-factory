import assert from "node:assert/strict";
import { test } from "node:test";
import { hasIssue, implementRunOf, itemFits, itemId, planItemSchema, takenItems, type Item } from "./item.mjs";

const home = { name: "hub", slug: "acme/hub" };
const context = { home, otherBranches: "- app: sandcastle/hub/issue-7-take-1" };
const full = (issue: string, repo = "hub"): Item => ({ issue, work: "", source: "issue", repo, title: "t", branch: "b" });

const planned = { repo: "app", title: "t" };

test("planItemSchema: an issue item", () => {
  assert.deepEqual(planItemSchema.parse({ ...planned, issue: "42" }), { ...planned, issue: "42", work: "", source: "issue" });
});

test("planItemSchema: a work item with its source", () => {
  assert.deepEqual(planItemSchema.parse({ ...planned, work: "fix a.ts", source: "review" }), { ...planned, issue: "", work: "fix a.ts", source: "review" });
});

const refusal = (input: object): string => {
  const result = planItemSchema.safeParse(input);
  return result.success ? "" : result.error.issues.map((issue) => issue.message).join("; ");
};

test("planItemSchema: both issue and work are rejected", () => {
  assert.match(refusal({ ...planned, issue: "42", work: "fix a.ts", source: "review" }), /issue or work/);
});

test("planItemSchema: neither issue nor work is rejected", () => {
  assert.match(refusal(planned), /issue or work/);
  assert.match(refusal({ ...planned, issue: "", work: "" }), /issue or work/);
});

test("planItemSchema: a work item names its source, an issue item none", () => {
  assert.match(refusal({ ...planned, work: "fix a.ts" }), /source/);
  assert.match(refusal({ ...planned, issue: "42", source: "review" }), /source/);
});

test("implementRunOf: issue item in the home repo", () => {
  assert.deepEqual(implementRunOf({ ...full("42"), title: "Fix", branch: "br" }, { root: 7 }, context), {
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
    logBase: "implement-42",
  });
});

test("implementRunOf: an app repo's issue is read from the home repo", () => {
  const inputs = implementRunOf(full("42", "app"), { root: 7 }, context);
  assert.equal(inputs.promptArgs["WORK"], "https://github.com/acme/hub/issues/42");
  assert.equal(inputs.promptArgs["VERIFY"], "bash .sandcastle/repos/app/verify.sh");
});

const work: Item = { issue: "", work: "Fix a.ts:3", source: "plan check", repo: "app", title: "Fix check", branch: "int-work-2-3" };

test("implementRunOf: a work item gets its text, the root as issue, and names from its branch", () => {
  assert.deepEqual(implementRunOf(work, { root: 7 }, context), {
    promptArgs: {
      WORK: "Fix a.ts:3",
      READ: "This task has no issue: the text above is the whole task. You work in the repo `app`, the one checked out here. Commits reference the root and say what they fix.",
      ISSUE: "7",
      REPORT: "logs the note",
      TITLE: "Fix check",
      ROOT: "7",
      BRANCH: "int-work-2-3",
      DISCLAIMER: "> *Sandcastle agent reply — not a request.*",
      HOME_SLUG: "acme/hub",
      REPO_NAME: "app",
      VERIFY: "bash .sandcastle/repos/app/verify.sh",
      OTHER_BRANCHES: "- app: sandcastle/hub/issue-7-take-1",
    },
    name: "implement work-2-3",
    logBase: "implement-work-2-3",
  });
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

test("takenItems: items not started are dropped; work slugs count the taken, positions the plan", () => {
  const items = [{ issue: "" }, { issue: "42" }, { issue: "" }, { issue: "" }];
  assert.deepEqual(takenItems(items, [false, true, true, true]), [
    { item: { issue: "42" }, position: 2, slug: "42" },
    { item: { issue: "" }, position: 3, slug: "work-2" },
    { item: { issue: "" }, position: 4, slug: "work-3" },
  ]);
});
