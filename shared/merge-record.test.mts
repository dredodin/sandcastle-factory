import assert from "node:assert/strict";
import { test } from "node:test";
import type { Item } from "./item.mjs";
import { issuesIn, mergeCommand, messagesFor } from "./merge-record.mjs";

const item = (issue: string, comments: string[]): Item => ({ issue, repo: "app", title: "t", comments, brief: "", branch: "b" });
const commit = (i: Item): string => messagesFor(i).join("\n\n");

test("issuesIn: reads back what messagesFor writes, deduplicated, first-merged order", () => {
  const messages = [
    commit(item("7", [])),
    commit(item("3", [])),
    commit(item("3", ["https://github.com/acme/app/pull/50#discussion_r123"])),
    commit(item("7", [])),
    "SANDCASTLE: merge origin/main",
  ];
  assert.deepEqual(issuesIn(messages), [7, 3]);
});

test("issuesIn: comment item records its root issue", () => {
  const comment = item("42", ["https://github.com/acme/app/pull/50#issuecomment-456"]);
  assert.deepEqual(issuesIn([commit(comment)]), [42]);
});

test("issuesIn: messages with neither line are ignored", () => {
  assert.deepEqual(issuesIn(["SANDCASTLE: merge origin/main"]), []);
});

test("issuesIn: reads a message as already stored in git", () => {
  assert.deepEqual(issuesIn(["SANDCASTLE: merge #7\n\nIssue: #7"]), [7]);
});

test("messagesFor: subject then Issue trailer", () => {
  assert.deepEqual(messagesFor(item("7", [])), ["SANDCASTLE: merge #7", "Issue: #7"]);
  assert.deepEqual(messagesFor(item("42", ["https://github.com/acme/app/pull/50#issuecomment-456"])), [
    "SANDCASTLE: merge c456",
    "Issue: #42",
  ]);
});

test("issuesIn: a subject line alone counts, and wins over a trailer after it", () => {
  assert.deepEqual(issuesIn(["SANDCASTLE: merge #7"]), [7]);
  assert.deepEqual(issuesIn(["SANDCASTLE: merge #7\n\nIssue: #3"]), [7]);
});

test("issuesIn: a subject line alone, or a trailer alone, names the issue, wherever it sits", () => {
  assert.deepEqual(issuesIn(["body\nSANDCASTLE: merge #8"]), [8]);
  assert.deepEqual(issuesIn(["SANDCASTLE: merge c5\n\nIssue: #3"]), [3]);
  assert.deepEqual(issuesIn(["Issue: #4"]), [4]);
});

test("mergeCommand: one -m per message, in order", () => {
  assert.equal(mergeCommand("b", ["SANDCASTLE: merge #7", "Issue: #7"]), 'git merge --no-ff b -m "SANDCASTLE: merge #7" -m "Issue: #7"');
});
