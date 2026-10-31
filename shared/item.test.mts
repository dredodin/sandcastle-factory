import assert from "node:assert/strict";
import { test } from "node:test";
import { implementRunOf, itemFits, itemSchema, type Item } from "./item.mjs";

const home = { name: "hub", slug: "acme/hub" };
const context = { home, otherBranches: "- app: sandcastle/hub/issue-7-take-1" };
const full = (issue: string, repo = "hub"): Item => ({ issue, repo, title: "t", branch: "b" });

test("itemSchema: keeps every field of an item", () => {
  assert.deepEqual(itemSchema.parse(full("42", "app")), full("42", "app"));
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

const repos = [home, { name: "app", slug: "acme/app" }];

test("itemFits: a repo of the Workspace fits, an unknown one does not", () => {
  assert.equal(itemFits({ repo: "hub" }, repos), true);
  assert.equal(itemFits({ repo: "app" }, repos), true);
  assert.equal(itemFits({ repo: "web" }, repos), false);
});
