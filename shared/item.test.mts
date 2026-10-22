import assert from "node:assert/strict";
import { test } from "node:test";
import { implementRunOf, itemFits, itemSchema, itemSlug, mergeSubject, type Item } from "./item.mjs";

const home = { name: "hub", slug: "acme/hub" };
const context = { home, otherBranches: "- app: sandcastle/hub/issue-7-take-1" };
const issue = { issue: "42", comments: [] };
const comments = {
  issue: "42",
  comments: ["https://github.com/acme/app/pull/50#discussion_r123", "https://github.com/acme/app/pull/50#issuecomment-456"],
};

const full = (i: { issue: string; comments: string[] }, repo = "hub"): Item => ({ ...i, repo, title: "t", brief: "", branch: "b" });

test("itemSchema: keeps every field of an item", () => {
  assert.deepEqual(itemSchema.parse(full(comments, "app")), full(comments, "app"));
});

test("itemSlug: issue number, or c<id> of the first comment", () => {
  assert.equal(itemSlug(issue), "42");
  assert.equal(itemSlug(comments), "c123");
});

test("itemSlug: comments without a trailing id throw naming the comment", () => {
  assert.throws(() => itemSlug({ issue: "42", comments: ["https://x/no-id"] }), /no-id/);
});

test("implementRunOf: issue item in the home repo", () => {
  assert.deepEqual(implementRunOf({ ...full(issue), title: "Fix", brief: "b", branch: "br" }, { number: 3, root: 7 }, context), {
    promptArgs: {
      WORK: "https://github.com/acme/hub/issues/42",
      BRIEF: "b",
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
  const inputs = implementRunOf(full(issue, "app"), { number: 1, root: 7 }, context);
  assert.equal(inputs.promptArgs["WORK"], "https://github.com/acme/hub/issues/42");
  assert.equal(inputs.promptArgs["VERIFY"], "bash .sandcastle/repos/app/verify.sh");
  assert.equal(inputs.logName, "1-42-implement-app");
});

test("implementRunOf: comment item lists every comment URL and names by the first", () => {
  const inputs = implementRunOf(full(comments, "app"), { number: 1, root: 42 }, context);
  assert.equal(
    inputs.promptArgs["WORK"],
    "https://github.com/acme/app/pull/50#discussion_r123\nhttps://github.com/acme/app/pull/50#issuecomment-456",
  );
  assert.equal(inputs.name, "implement c123");
  assert.equal(inputs.logName, "1-c123-implement-app");
});

test("mergeSubject: #<n> for an issue, the slug for comments", () => {
  assert.equal(mergeSubject(issue), "#42");
  assert.equal(mergeSubject(comments), "c123");
});

const repos = [home, { name: "app", slug: "acme/app" }];

test("itemFits: a known repo without comments, or with its own comments", () => {
  assert.equal(itemFits({ repo: "hub", comments: [] }, repos), true);
  assert.equal(itemFits({ repo: "app", comments: comments.comments }, repos), true);
});

test("itemFits: an unknown repo does not fit", () => {
  assert.equal(itemFits({ repo: "web", comments: [] }, repos), false);
});

test("itemFits: a comment of another repo's PR does not fit", () => {
  assert.equal(itemFits({ repo: "hub", comments: comments.comments }, repos), false);
});
