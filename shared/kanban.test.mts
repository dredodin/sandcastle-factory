import assert from "node:assert/strict";
import { test } from "node:test";
import { preflight, rootAction, toStatus, type Action, type RootEvent, type Status } from "./kanban.mjs";

const set = (status: Status): Action => ({ type: "set", status });
const refused = (current: Status | null, event: RootEvent): boolean => rootAction(current, event).type === "refuse";

const TRANSITIONS: readonly (readonly [string, Status, RootEvent, Status])[] = [
  ["R3 from Ready for agent", "Ready for agent", "take", "Agent working"],
  ["R3 from In review", "In review", "take", "Agent working"],
  ["R4", "Agent working", "prOpened", "In review"],
  ["R5", "Agent working", "endedWithoutPr", "Backlog"],
  ["R6 from Ready for agent", "Ready for agent", "resume", "Agent working"],
  ["R6 from Agent working", "Agent working", "resume", "Agent working"],
  ["R6 from In review", "In review", "resume", "Agent working"],
];

for (const [row, from, event, to] of TRANSITIONS) {
  test(`rootAction: ${row}`, () => assert.deepEqual(rootAction(from, event), set(to)));
}

const REFUSALS: readonly (readonly [Status | null, RootEvent])[] = [
  ["Backlog", "take"],
  ["Agent working", "take"],
  ["Done", "take"],
  ["Backlog", "resume"],
  ["Done", "resume"],
  ["Ready for agent", "prOpened"],
  ["Ready for agent", "endedWithoutPr"],
  [null, "take"],
  [null, "resume"],
];

for (const [from, event] of REFUSALS) {
  test(`rootAction: ${event} from ${from ?? "no card"} is refused`, () => assert.ok(refused(from, event)));
}

test("rootAction: a refusal says why", () => {
  assert.deepEqual(rootAction("Backlog", "resume"), { type: "refuse", reason: "resume starts from Ready for agent, Agent working or In review, its Status is Backlog" });
});

const OPTIONS = ["Backlog", "Ready for agent", "Agent working", "In review", "Done"];
const WORKFLOWS = [{ name: "Item closed", enabled: true }, { name: "Item added to project", enabled: false }];

test("preflight: a correct board has no problem", () => assert.deepEqual(preflight({ options: OPTIONS, workflows: WORKFLOWS }), []));

test("preflight: a missing option is a problem", () => {
  assert.deepEqual(preflight({ options: OPTIONS.filter((option) => option !== "In review"), workflows: WORKFLOWS }), ['Status option "In review" is missing: add it']);
});

test("preflight: a renamed option is one missing and one extra", () => {
  const options = OPTIONS.map((option) => (option === "Done" ? "Finished" : option));
  assert.deepEqual(preflight({ options, workflows: WORKFLOWS }), [
    'Status option "Done" is missing: add it',
    'Status option "Finished" is extra: remove it or rename it to one of Backlog, Ready for agent, Agent working, In review, Done',
  ]);
});

test("preflight: an extra option is a problem", () => {
  assert.equal(preflight({ options: [...OPTIONS, "Blocked"], workflows: WORKFLOWS }).length, 1);
});

test("preflight: Item closed off or absent is a problem", () => {
  const problem = ['Built-in workflow "Item closed" is off: switch it on'];
  assert.deepEqual(preflight({ options: OPTIONS, workflows: [{ name: "Item closed", enabled: false }] }), problem);
  assert.deepEqual(preflight({ options: OPTIONS, workflows: [] }), problem);
});

test("rootAction: refusal reasons", () => {
  assert.deepEqual(rootAction(null, "take"), { type: "refuse", reason: "it is not on the Kanban: add it, with Status Ready for agent" });
  assert.deepEqual(rootAction("Agent working", "take"), { type: "refuse", reason: "take starts from Ready for agent or In review, its Status is Agent working" });
  assert.deepEqual(rootAction("Backlog", "prOpened"), { type: "refuse", reason: "a PR opened while its Status is Backlog, not Agent working" });
  assert.deepEqual(rootAction("In review", "endedWithoutPr"), { type: "refuse", reason: "the run ended without a PR while its Status is In review, not Agent working" });
});

test("toStatus: the five names, nothing else", () => {
  assert.equal(toStatus("In review"), "In review");
  assert.equal(toStatus("Blocked"), null);
});

test("preflight: an extra option's message", () => {
  assert.deepEqual(preflight({ options: [...OPTIONS, "Blocked"], workflows: WORKFLOWS }), [
    'Status option "Blocked" is extra: remove it or rename it to one of Backlog, Ready for agent, Agent working, In review, Done',
  ]);
});

test("rootAction: resume from Done says its Status", () => {
  assert.deepEqual(rootAction("Done", "resume"), { type: "refuse", reason: "resume starts from Ready for agent, Agent working or In review, its Status is Done" });
});
