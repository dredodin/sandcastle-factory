import assert from "node:assert/strict";
import { test } from "node:test";
import { next, preflight, type Event, type Next } from "./kanban.mjs";
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
  ["S4 findings rejected", "Agent working", "findings rejected", close("not planned")],
  ["S5 cannot finish", "Agent working", "cannot finish", set("Backlog")],
  ["S5 merge conflict", "Agent working", "merge conflict", set("Backlog")],
  ["S6", "Agent working", "crashed", set("Ready for agent")],
  ["S7", "Done", "retake", { type: "reopen" }],
];

for (const [row, from, event, expected] of TRANSITIONS) {
  test(`next: ${row}`, () => assert.deepEqual(next(from, event), expected));
}

const REFUSALS: readonly (readonly [Status | null, Event, string])[] = [
  ["Backlog", "take", "take needs Status Ready for agent or In review, it is Backlog"],
  ["Agent working", "take", "take needs Status Ready for agent or In review, it is Agent working"],
  ["Done", "take", "take needs Status Ready for agent or In review, it is Done"],
  ["Backlog", "resume", "resume needs Status Ready for agent or Agent working or In review, it is Backlog"],
  [null, "take", "take needs Status Ready for agent or In review, it is not on the Kanban"],
  ["Ready for agent", "pr opened", "pr opened needs Status Agent working, it is Ready for agent"],
  ["In review", "run ended without pr", "run ended without pr needs Status Agent working, it is In review"],
  ["Backlog", "planned", "planned needs Status Ready for agent, it is Backlog"],
  ["Agent working", "planned", "planned needs Status Ready for agent, it is Agent working"],
  ["Ready for agent", "merged", "merged needs Status Agent working, it is Ready for agent"],
  ["Done", "cannot finish", "cannot finish needs Status Agent working, it is Done"],
  ["In review", "crashed", "crashed needs Status Agent working, it is In review"],
  ["Backlog", "retake", "retake needs Status Done, it is Backlog"],
];

for (const [from, event, reason] of REFUSALS) {
  test(`next: ${event} from ${from ?? "no card"} is refused`, () => assert.deepEqual(next(from, event), { type: "refuse", reason }));
}

const OPTIONS = ["Backlog", "Ready for agent", "Agent working", "In review", "Done"];

test("preflight: a correct Kanban has no problem", () => assert.deepEqual(preflight(OPTIONS), []));

test("preflight: a missing, an extra and a renamed option are named", () => {
  assert.deepEqual(preflight(OPTIONS.filter((option) => option !== "In review")), ['Status option "In review" is missing: add it']);
  assert.deepEqual(preflight([...OPTIONS, "Blocked"]), ['Status option "Blocked" is extra: remove it or rename it to one of Backlog, Ready for agent, Agent working, In review, Done']);
  assert.equal(preflight(OPTIONS.map((option) => (option === "Done" ? "Finished" : option))).length, 2);
});
