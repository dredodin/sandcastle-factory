// The Kanban's state machine and preflight: pure. The `gh` calls are in kanban-gh.mts.

export const STATUSES = ["Backlog", "Ready for agent", "Agent working", "In review", "Done"] as const;
export type Status = (typeof STATUSES)[number];

// What happens to the root issue's card; the root rows of the machine.
export type RootEvent = "take" | "resume" | "prOpened" | "endedWithoutPr";

export type Kanban = { readonly owner: string; readonly number: number };

// The Status named, or null for a name that is none of the five.
export const toStatus = (name: string): Status | null => STATUSES.find((status) => status === name) ?? null;

export type Action = { readonly type: "set"; readonly status: Status } | { readonly type: "refuse"; readonly reason: string };

const set = (status: Status): Action => ({ type: "set", status });
const refuse = (reason: string): Action => ({ type: "refuse", reason });

// What the factory does with the root's card, given its Status. `current` is null when the root is not on the Kanban.
export const rootAction = (current: Status | null, event: RootEvent): Action => {
  if (current === null) return refuse("it is not on the Kanban: add it, with Status Ready for agent");
  switch (event) {
    case "take":
      if (current === "Ready for agent" || current === "In review") return set("Agent working");
      return refuse(`take starts from Ready for agent or In review, its Status is ${current}`);
    case "resume":
      if (current === "Ready for agent" || current === "Agent working" || current === "In review") return set("Agent working");
      return refuse(`resume starts from Ready for agent, Agent working or In review, its Status is ${current}`);
    case "prOpened":
      return current === "Agent working" ? set("In review") : refuse(`a PR opened while its Status is ${current}, not Agent working`);
    case "endedWithoutPr":
      return current === "Agent working" ? set("Backlog") : refuse(`the run ended without a PR while its Status is ${current}, not Agent working`);
  }
};

export type CloseReason = "completed" | "not planned";
export type SubAction = Action | { readonly type: "close"; readonly reason: CloseReason } | { readonly type: "reopen" };

// What happens to a sub-issue's card: the plan took it (S3); its work merged (S4); implement ended without commits (S4, S5);
// a merge left its branch out (S5); the run crashed (S6); a new take reopens what the old one closed (S7).
export type SubEvent = "planned" | "merged" | "doneWithoutCode" | "alreadyDone" | "findingsRejected" | "cannotFinish" | "mergeConflict" | "crashed" | "retake";

const close = (reason: CloseReason): SubAction => ({ type: "close", reason });

// What the factory does with a sub-issue, given its Status. `current` is null when it is not on the Kanban.
export const subAction = (current: Status | null, event: SubEvent): SubAction => {
  const from = current ?? "none";
  if (event === "planned") return current === "Ready for agent" ? set("Agent working") : refuse(`planned while its Status is ${from}, not Ready for agent`);
  if (event === "retake") return current === "Done" ? { type: "reopen" } : refuse(`retake while its Status is ${from}, not Done`);
  if (current !== "Agent working") return refuse(`${event} while its Status is ${from}, not Agent working`);
  switch (event) {
    case "merged":
    case "doneWithoutCode":
    case "alreadyDone":
      return close("completed");
    case "findingsRejected":
      return close("not planned");
    case "cannotFinish":
    case "mergeConflict":
      return set("Backlog");
    case "crashed":
      return set("Ready for agent");
  }
};

// Whether a take from this Status first closes the old take's PRs and reopens what it closed (R3).
export const reopensOldTake = (current: Status | null): boolean => current === "In review";

// The line of a close comment that names the take, and whether any comment carries it.
export const takeLine = (branch: string): string => `Take: \`${branch}\`.`;
export const closedByTake = (comments: readonly string[], branch: string): boolean => comments.some((body) => body.split("\n").includes(takeLine(branch)));

export type KanbanField = {
  readonly options: readonly string[];
  readonly workflows: readonly { readonly name: string; readonly enabled: boolean }[];
};

// Built-in workflows the machine depends on and the API lists. Item reopened is not here: the API omits it even when on.
const REQUIRED_WORKFLOWS = ["Item added to project", "Item closed"] as const;

// Why the Kanban cannot run the machine; empty when it can.
export const preflight = (kanban: KanbanField): readonly string[] => [
  ...STATUSES.filter((status) => !kanban.options.includes(status)).map((status) => `Status option "${status}" is missing: add it`),
  ...kanban.options.filter((option) => toStatus(option) === null).map((option) => `Status option "${option}" is extra: remove it or rename it to one of ${STATUSES.join(", ")}`),
  ...REQUIRED_WORKFLOWS.filter((name) => !kanban.workflows.some((workflow) => workflow.name === name && workflow.enabled)).map((name) => `Built-in workflow "${name}" is off: switch it on`),
];

// What `addReady` does with an issue it has just added to the Kanban, given its Status before and after the add:
// "skip" when it was already there and past Backlog (a retry: Item added has fired or never will), else "wait" for Backlog.
export const readyStep = (before: Status | null, after: Status | null): "skip" | "wait" => (before !== null && after !== "Backlog" ? "skip" : "wait");
