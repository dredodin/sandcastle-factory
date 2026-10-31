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
export type SubAction = Action | { readonly type: "close"; readonly reason: CloseReason };

// What happens to a sub-issue's card: the plan took it (S3), its work merged into the integration branch (S4).
export type SubEvent = "planned" | "merged";

// What the factory does with a sub-issue, given its Status. `current` is null when it is not on the Kanban.
export const subAction = (current: Status | null, event: SubEvent): SubAction => {
  switch (event) {
    case "planned":
      return current === "Ready for agent" ? set("Agent working") : refuse(`planned while its Status is ${current ?? "none"}, not Ready for agent`);
    case "merged":
      return current === "Agent working" ? { type: "close", reason: "completed" } : refuse(`merged while its Status is ${current ?? "none"}, not Agent working`);
  }
};

export type Board = {
  readonly options: readonly string[];
  readonly workflows: readonly { readonly name: string; readonly enabled: boolean }[];
};

// Built-in workflows the machine depends on and the API lists. Item reopened is not here: the API omits it even when on.
const REQUIRED_WORKFLOWS = ["Item closed"] as const;

// Why the Kanban cannot run the machine; empty when it can.
export const preflight = (board: Board): readonly string[] => [
  ...STATUSES.filter((status) => !board.options.includes(status)).map((status) => `Status option "${status}" is missing: add it`),
  ...board.options.filter((option) => toStatus(option) === null).map((option) => `Status option "${option}" is extra: remove it or rename it to one of ${STATUSES.join(", ")}`),
  ...REQUIRED_WORKFLOWS.filter((name) => !board.workflows.some((workflow) => workflow.name === name && workflow.enabled)).map((name) => `Built-in workflow "${name}" is off: switch it on`),
];
