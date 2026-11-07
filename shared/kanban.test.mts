import assert from "node:assert/strict";
import { test } from "node:test";
import { next, preflight, reconcile, treeOf, type Event, type Next, type Outcome } from "./kanban.mjs";
import type { Status } from "./status.mjs";

const set = (status: Status): Next => ({ type: "set", status });
const close = (reason: "completed" | "not planned"): Next => ({ type: "close", reason });

// One row per Rx/Sx transition of the issue's machine.
const TRANSITIONS: readonly (readonly [string, Status, Event, Next])[] = [
  ["R3 from Ready for agent", "Ready for agent", "take", set("Agent working")],
  ["R3 from In review", "In review", "take", set("Agent working")],
  ["R4", "Agent working", "pr opened", set("In review")],
  ["R5", "Agent working", "run ended without pr", set("Backlog")],
  ["R6 from Ready for agent", "Ready for agent", "resume", set("Agent working")],
  ["R6 from Agent working", "Agent working", "resume", set("Agent working")],
  ["R6 from In review", "In review", "resume", set("Agent working")],
  ["S3", "Ready for agent", "planned", set("Agent working")],
  ["S4 merged", "Agent working", "merged", close("completed")],
  ["S4 done without code", "Agent working", "done without code", close("completed")],
  ["S4 already done", "Agent working", "already done", close("completed")],
  ["S5 cannot finish", "Agent working", "cannot finish", set("Backlog")],
  ["S5 merge conflict", "Agent working", "merge conflict", set("Backlog")],
  ["S6", "Agent working", "crashed", set("Ready for agent")],
  ["S7", "Done", "retake", { type: "reopen" }],
];

for (const [row, from, event, expected] of TRANSITIONS) {
  test(`next: ${row}`, () => assert.deepEqual(next(from, event), expected));
}

const REFUSALS: readonly (readonly [Status | null, Event, RegExp])[] = [
  ["Backlog", "take", /Ready for agent or In review/],
  ["Agent working", "take", /Agent working/],
  ["Done", "take", /Done/],
  ["Backlog", "resume", /Backlog/],
  [null, "take", /not on the Kanban/],
  ["Ready for agent", "pr opened", /Ready for agent/],
  ["In review", "run ended without pr", /In review/],
  ["Backlog", "planned", /Backlog/],
  ["Agent working", "planned", /Agent working/],
  ["Ready for agent", "merged", /Ready for agent/],
  ["Done", "cannot finish", /Done/],
  ["In review", "crashed", /In review/],
  ["Backlog", "retake", /Backlog/],
];

for (const [from, event, reason] of REFUSALS) {
  test(`next: ${event} from ${from ?? "no card"} is refused`, () => {
    const action = next(from, event);
    assert.equal(action.type, "refuse");
    assert.match(action.type === "refuse" ? action.reason : "", reason);
  });
}

const OPTIONS = ["Backlog", "Ready for agent", "Agent working", "In review", "Done"];

test("preflight: a correct Kanban has no problem", () => assert.deepEqual(preflight(OPTIONS), []));

test("preflight: a missing, an extra and a renamed option are named", () => {
  assert.match(preflight(OPTIONS.filter((option) => option !== "In review")).join("\n"), /"In review"/);
  assert.match(preflight([...OPTIONS, "Blocked"]).join("\n"), /"Blocked".*Backlog, Ready for agent/);
  assert.equal(preflight(OPTIONS.map((option) => (option === "Done" ? "Finished" : option))).length, 2);
});

const KANBAN = "PVT_kanban";
const item = (project: string, status: string | null): object => ({ project: { id: project }, fieldValueByName: status === null ? null : { name: status } });
const node = (number: number, ...items: readonly object[]): object => ({ number, projectItems: { nodes: items } });
// The shape `gh api graphql` prints for the tree query.
const response = (root: object, subs: readonly object[]): string => JSON.stringify({ data: { repository: { issue: { ...root, subIssues: { nodes: subs } } } } });

test("treeOf: reads each issue's Status on the Kanban only", () => {
  const tree = treeOf(
    response(node(1, item("PVT_other", "Done"), item(KANBAN, "In review")), [
      node(12, item(KANBAN, "Agent working")),
      node(7, item(KANBAN, null)),
      node(9),
      node(4, item("PVT_other", "Ready for agent")),
      node(5, item(KANBAN, "Blocked")),
    ]),
    KANBAN,
  );
  assert.deepEqual(tree.subIssues, [12, 7, 9, 4, 5]);
  assert.deepEqual(
    tree.statuses,
    new Map([
      [1, "In review"],
      [12, "Agent working"],
      [7, null],
      [9, null],
      [4, null],
      [5, null],
    ]),
  );
});

test("treeOf: a root without sub-issues", () => {
  const tree = treeOf(response(node(1, item(KANBAN, "Ready for agent")), []), KANBAN);
  assert.deepEqual(tree.subIssues, []);
  assert.deepEqual(tree.statuses, new Map([[1, "Ready for agent"]]));
});

test("reconcile: reported outcome against commit count", () => {
  const cases: [Outcome, number, Outcome, string][] = [
    ["committed", 0, "cannot finish", "The run reported committed with no commits."],
    ["committed", 2, "committed", "n"],
    ["done without code", 0, "done without code", "n"],
    ["already done", 0, "already done", "n"],
    ["done without code", 1, "committed", 'Reported "done without code", but the run has commits. n'],
    ["already done", 3, "committed", 'Reported "already done", but the run has commits. n'],
    ["cannot finish", 0, "cannot finish", "n"],
    ["cannot finish", 2, "cannot finish", "n"],
  ];
  for (const [reported, commits, outcome, note] of cases) {
    assert.deepEqual(reconcile({ outcome: reported, note: "n" }, commits), { outcome, note }, `${reported} with ${commits}`);
  }
  assert.equal(reconcile({ outcome: "already done", note: "" }, 1).note, 'Reported "already done", but the run has commits.');
});
