import assert from "node:assert/strict";
import { test } from "node:test";
import { closedByTake, preflight, reopensOldTake, rootAction, subAction, takeLine, readyStep, toStatus, type Action, type RootEvent, type Status, type SubAction, type SubEvent } from "./kanban.mjs";

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

const EXTRA = 'Status option "Blocked" is extra: remove it or rename it to one of Backlog, Ready for agent, Agent working, In review, Done';
const OPTIONS = ["Backlog", "Ready for agent", "Agent working", "In review", "Done"];
const WORKFLOWS = [{ name: "Item added to project", enabled: true }, { name: "Item closed", enabled: true }];
const off = (name: string): string => `Built-in workflow "${name}" is off: switch it on`;

test("preflight: a correct Kanban has no problem", () => assert.deepEqual(preflight({ options: OPTIONS, workflows: WORKFLOWS }), []));

test("preflight: problems and their messages", () => {
  assert.deepEqual(preflight({ options: OPTIONS.filter((option) => option !== "In review"), workflows: WORKFLOWS }), ['Status option "In review" is missing: add it']);
  assert.deepEqual(preflight({ options: [...OPTIONS, "Blocked"], workflows: WORKFLOWS }), [EXTRA]);
  assert.deepEqual(preflight({ options: OPTIONS.map((option) => (option === "Done" ? "Finished" : option)), workflows: WORKFLOWS }), [
    'Status option "Done" is missing: add it',
    'Status option "Finished" is extra: remove it or rename it to one of Backlog, Ready for agent, Agent working, In review, Done',
  ]);
});

test("preflight: a built-in workflow off or absent is a problem, another one on does not count", () => {
  assert.deepEqual(preflight({ options: OPTIONS, workflows: [{ name: "Item added to project", enabled: true }, { name: "Item closed", enabled: false }] }), [off("Item closed")]);
  assert.deepEqual(preflight({ options: OPTIONS, workflows: [{ name: "Item closed", enabled: true }] }), [off("Item added to project")]);
  assert.deepEqual(preflight({ options: OPTIONS, workflows: [{ name: "Item closed", enabled: false }, { name: "Item added to project", enabled: true }] }), [off("Item closed")]);
  assert.deepEqual(preflight({ options: OPTIONS, workflows: [] }), [off("Item added to project"), off("Item closed")]);
});

test("rootAction: refusal reasons", () => {
  assert.deepEqual(rootAction(null, "take"), { type: "refuse", reason: "it is not on the Kanban: add it, with Status Ready for agent" });
  assert.deepEqual(rootAction("Agent working", "take"), { type: "refuse", reason: "take starts from Ready for agent or In review, its Status is Agent working" });
  assert.deepEqual(rootAction("Backlog", "resume"), { type: "refuse", reason: "resume starts from Ready for agent, Agent working or In review, its Status is Backlog" });
  assert.deepEqual(rootAction("Done", "resume"), { type: "refuse", reason: "resume starts from Ready for agent, Agent working or In review, its Status is Done" });
  assert.deepEqual(rootAction("Backlog", "prOpened"), { type: "refuse", reason: "a PR opened while its Status is Backlog, not Agent working" });
  assert.deepEqual(rootAction("In review", "endedWithoutPr"), { type: "refuse", reason: "the run ended without a PR while its Status is In review, not Agent working" });
});

test("toStatus: the five names, nothing else", () => {
  assert.equal(toStatus("In review"), "In review");
  assert.equal(toStatus("Blocked"), null);
});

test("subAction: S3 the plan takes a Ready for agent sub-issue", () => assert.deepEqual(subAction("Ready for agent", "planned"), set("Agent working")));

test("subAction: S4 merged work closes the sub-issue as completed", () => assert.deepEqual(subAction("Agent working", "merged"), { type: "close", reason: "completed" }));

for (const [from, event] of [["Backlog", "planned"], ["Agent working", "planned"], ["Done", "planned"], [null, "planned"], ["Ready for agent", "merged"], ["Done", "merged"], [null, "merged"]] as const) {
  test(`subAction: ${event} from ${from ?? "no card"} is refused`, () => assert.equal(subAction(from, event).type, "refuse"));
}

test("subAction: refusal reasons", () => {
  assert.deepEqual(subAction("Backlog", "planned"), { type: "refuse", reason: "planned while its Status is Backlog, not Ready for agent" });
  assert.deepEqual(subAction(null, "merged"), { type: "refuse", reason: "merged while its Status is none, not Agent working" });
  assert.deepEqual(subAction("Done", "cannotFinish"), { type: "refuse", reason: "cannotFinish while its Status is Done, not Agent working" });
});

const SUB_TRANSITIONS: readonly (readonly [string, Status, SubEvent, SubAction])[] = [
  ["S4 done without code", "Agent working", "doneWithoutCode", { type: "close", reason: "completed" }],
  ["S4 already done", "Agent working", "alreadyDone", { type: "close", reason: "completed" }],
  ["S4 findings rejected", "Agent working", "findingsRejected", { type: "close", reason: "not planned" }],
  ["S5 cannot finish", "Agent working", "cannotFinish", set("Backlog")],
  ["S5 merge conflict", "Agent working", "mergeConflict", set("Backlog")],
  ["S6 crashed", "Agent working", "crashed", set("Ready for agent")],
  ["S7 retake", "Done", "retake", { type: "reopen" }],
];

for (const [row, from, event, action] of SUB_TRANSITIONS) {
  test(`subAction: ${row}`, () => assert.deepEqual(subAction(from, event), action));
}

for (const event of ["doneWithoutCode", "alreadyDone", "findingsRejected", "cannotFinish", "mergeConflict", "crashed"] as const) {
  for (const from of ["Backlog", "Ready for agent", "In review", "Done", null] as const) {
    test(`subAction: ${event} from ${from ?? "no card"} is refused`, () => assert.equal(subAction(from, event).type, "refuse"));
  }
}

test("subAction: retake only from Done", () => {
  assert.deepEqual(subAction("Backlog", "retake"), { type: "refuse", reason: "retake while its Status is Backlog, not Done" });
  assert.deepEqual(subAction(null, "retake"), { type: "refuse", reason: "retake while its Status is none, not Done" });
  assert.equal(subAction("Agent working", "retake").type, "refuse");
});

test("reopensOldTake: R3 from In review only", () => {
  assert.equal(reopensOldTake("In review"), true);
  assert.equal(reopensOldTake("Ready for agent"), false);
  assert.equal(reopensOldTake(null), false);
});

test("closedByTake: a comment with the take's line, whole", () => {
  assert.equal(takeLine("sandcastle/app/issue-7-take-1"), "Take: `sandcastle/app/issue-7-take-1`.");
  assert.equal(closedByTake(["hi", `Done.\n\n${takeLine("b-1")}`], "b-1"), true);
  assert.equal(closedByTake([takeLine("b-1")], "b-10"), false);
  assert.equal(closedByTake([], "b-1"), false);
});

test("readyStep: skip a retry past Backlog; wait for Backlog otherwise", () => {
  assert.equal(readyStep("Ready for agent", "Ready for agent"), "skip");
  assert.equal(readyStep("Done", null), "skip");
  assert.equal(readyStep("Backlog", "Backlog"), "wait");
  assert.equal(readyStep(null, "Backlog"), "wait");
  assert.equal(readyStep(null, null), "wait");
});
