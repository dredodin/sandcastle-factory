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
  ["S1 created", "Backlog", "created", set("Ready for agent")],
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
  ["Ready for agent", "created", /Ready for agent/],
  [null, "created", /not on the Kanban/],
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
