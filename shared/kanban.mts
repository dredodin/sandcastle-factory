// The Kanban: the state machine of an issue's Status, and the `gh` calls that apply it. A failed call throws; no write is best effort.
// Token scopes: README, Requirements.

import { z } from "zod";
import { message } from "./cli.mjs";
import { log } from "./logger.mjs";
import { latestTake } from "./repo.mjs";
import { DISCLAIMER } from "./run.mjs";
import { sh, shIn } from "./shell.mjs";
import { STATUSES, type Status } from "./status.mjs";
import type { Workspace } from "./workspace.mjs";

export type KanbanRef = { readonly owner: string; readonly number: number };

// What a run came to: its report, and whether it opened or updated a PR.
export type RunResult = { readonly text: string; readonly pr: boolean };

export type Next =
  | { readonly type: "set"; readonly status: Status }
  | { readonly type: "close"; readonly reason: "completed" | "not planned" }
  | { readonly type: "reopen" }
  | { readonly type: "refuse"; readonly reason: string };

const set = (status: Status): Next => ({ type: "set", status });
const close = (reason: "completed" | "not planned"): Next => ({ type: "close", reason });

// The machine: each event, the Statuses it may start from, and what it does. Root: take .. run ended without PR. Sub-issue: the rest. `created` is S1 for issues the factory adds.
type Move = { readonly from: readonly Status[]; readonly to: Next };

const MOVES = {
  take: { from: ["Ready for agent", "In review"], to: set("Agent working") },
  resume: { from: ["Ready for agent", "Agent working", "In review"], to: set("Agent working") },
  "pr opened": { from: ["Agent working"], to: set("In review") },
  "run ended without pr": { from: ["Agent working"], to: set("Backlog") },
  planned: { from: ["Ready for agent"], to: set("Agent working") },
  created: { from: ["Backlog"], to: set("Ready for agent") },
  merged: { from: ["Agent working"], to: close("completed") },
  "done without code": { from: ["Agent working"], to: close("completed") },
  "already done": { from: ["Agent working"], to: close("completed") },
  "findings rejected": { from: ["Agent working"], to: close("not planned") },
  "cannot finish": { from: ["Agent working"], to: set("Backlog") },
  "merge conflict": { from: ["Agent working"], to: set("Backlog") },
  crashed: { from: ["Agent working"], to: set("Ready for agent") },
  retake: { from: ["Done"], to: { type: "reopen" } },
} satisfies Record<string, Move>;

export type Event = keyof typeof MOVES;

// What implement reports; `committed` is merged first, the rest are events.
export const OUTCOMES = ["committed", "done without code", "already done", "findings rejected", "cannot finish"] as const;
export type Outcome = (typeof OUTCOMES)[number];

// What the factory does with an issue in `status` (null: not on the Kanban) on `event`.
export const next = (status: Status | null, event: Event): Next => {
  const { from, to }: Move = MOVES[event];
  if (from.some((entry) => entry === status)) return to;
  return { type: "refuse", reason: `${event} needs Status ${from.join(" or ")}, it is ${status ?? "not on the Kanban"}` };
};

// Why the Status options cannot run the machine; empty when they can.
export const preflight = (options: readonly string[]): readonly string[] => [
  ...STATUSES.filter((status) => !options.includes(status)).map((status) => `Status option "${status}" is missing: add it`),
  ...options.filter((option) => !STATUSES.some((status) => status === option)).map((option) => `Status option "${option}" is extra: remove it or rename it to one of ${STATUSES.join(", ")}`),
];

// Stryker disable all: from here the code is `gh` calls, beside the pure machine above.
export type Kanban = {
  // Applies `event` to the issue: reads its Status, asks the machine, writes. A refusal is logged. Resolves to whether it was not refused.
  // The root's card moves only by `run`; here it only gets the note of an implement outcome or a merge conflict.
  readonly move: (issue: number, event: Event, note?: string) => Promise<boolean>;
  // Adds new issues to the Kanban in Ready for agent (S1).
  readonly ready: (issues: readonly number[]) => Promise<void>;
  // The root's sub-issues, and those in the Status.
  readonly subIssues: () => readonly number[];
  readonly inStatus: (status: Status) => readonly number[];
};

export type KanbanRun = {
  // Refuses (throws) unless the root's Status allows the event. Then: R3 from In review closes the old take's PRs and reopens what it closed;
  // `branchOf` names the integration branch (after that); root to Agent working; Agent working sub-issues left by a killed process back to Ready for agent;
  // `work` (given the Kanban bound to the branch); root to In review when it opened a PR, else to Backlog with the reason.
  // A throw of `work` returns the Agent working sub-issues to Ready for agent and leaves the root in Agent working: `resume` continues from there.
  readonly run: (event: "take" | "resume", branchOf: () => string, work: (kanban: Kanban, branch: string) => Promise<RunResult>) => Promise<string>;
};

const WAIT_MS = 120_000;
const POLL_MS = 2_000;
const LIMIT = 1000;

const fieldsSchema = z.object({
  fields: z.array(z.object({ id: z.string(), name: z.string(), options: z.array(z.object({ id: z.string(), name: z.string() })).default([]) })),
});
const itemsSchema = z.object({
  items: z.array(z.object({ status: z.string().optional(), content: z.object({ number: z.number().optional(), repository: z.string().optional() }) })),
});
const idSchema = z.object({ id: z.string() });
const subIssuesSchema = z.object({ subIssues: z.array(z.object({ number: z.number() })) });
const prsSchema = z.array(z.object({ url: z.string() }));
const viewSchema = z.object({ state: z.string(), comments: z.array(z.object({ body: z.string() })) });

// Reads the Kanban and refuses (throws, naming what to fix) when it cannot run the machine.
export const openKanban = (workspace: Workspace, ref: KanbanRef, root: number): KanbanRun => {
  const { home } = workspace;
  const number = `${ref.number}`;
  const gh = (...args: readonly string[]): string => sh(home.path, "gh", ...args);
  const project = (...args: readonly string[]): string => gh("project", ...args, "--owner", ref.owner);
  const where = `${ref.owner}/${ref.number}`;

  const read = ((): { readonly projectId: string; readonly fieldId: string; readonly options: Readonly<Record<string, string>> } => {
    try {
      const { id } = idSchema.parse(JSON.parse(project("view", number, "--format", "json")));
      const field = fieldsSchema.parse(JSON.parse(project("field-list", number, "--format", "json"))).fields.find((entry) => entry.name === "Status");
      if (field === undefined) throw new Error("it has no Status field");
      return { projectId: id, fieldId: field.id, options: Object.fromEntries(field.options.map((option) => [option.name, option.id])) };
    } catch (error) {
      throw new Error(`The Kanban ${where} cannot be read: ${message(error)}. Check KANBAN_OWNER, KANBAN_NUMBER and that GH_TOKEN is the classic token the README names.`);
    }
  })();
  const problems = preflight(Object.keys(read.options));
  if (problems.length > 0) throw new Error(`The Kanban ${where} cannot run the factory:\n${problems.map((problem) => `- ${problem}`).join("\n")}`);

  const statuses = (): ReadonlyMap<number, Status | null> => {
    const { items } = itemsSchema.parse(JSON.parse(project("item-list", number, "--format", "json", "--limit", `${LIMIT}`)));
    if (items.length >= LIMIT) throw new Error(`The Kanban ${where} has ${LIMIT} items or more: the factory cannot read it whole.`);
    return new Map(
      items.flatMap(({ status, content }) =>
        content.repository === home.slug && content.number !== undefined ? [[content.number, STATUSES.find((entry) => entry === status) ?? null] as const] : [],
      ),
    );
  };
  const status = (issue: number): Status | null => statuses().get(issue) ?? null;
  const subIssues = (): readonly number[] =>
    subIssuesSchema.parse(JSON.parse(gh("issue", "view", `${root}`, "--repo", home.slug, "--json", "subIssues"))).subIssues.map((sub) => sub.number);
  const inStatus = (wanted: Status): readonly number[] => {
    const all = statuses();
    return subIssues().filter((issue) => all.get(issue) === wanted);
  };

  // Adds the issue to the Kanban (an upsert); returns its item id.
  const add = (issue: number): string => idSchema.parse(JSON.parse(project("item-add", number, "--url", `https://github.com/${home.slug}/issues/${issue}`, "--format", "json"))).id;
  const put = (issue: number, to: Status): void => {
    gh("project", "item-edit", "--id", add(issue), "--project-id", read.projectId, "--field-id", read.fieldId, "--single-select-option-id", read.options[to]!);
  };
  const comment = (issue: number, body: string): void => {
    shIn(home.path, `${DISCLAIMER}\n\n${body}`, "gh", "issue", "comment", `${issue}`, "--repo", home.slug, "--body-file", "-");
  };
  // Waits until a built-in workflow shows the issue's Status as `ok`; throws naming `fix` when it never does.
  const waitFor = async (issue: number, ok: (current: Status | null) => boolean, shown: string, fix: string): Promise<void> => {
    const deadline = Date.now() + WAIT_MS;
    while (!ok(status(issue))) {
      if (Date.now() > deadline) throw new Error(`#${issue} did not show ${shown} on the Kanban: ${fix}.`);
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  };
  const takeLine = (branch: string): string => `Take: \`${branch}\`.`;

  const at = (branch: string): Kanban => {
    const move = async (issue: number, event: Event, note = ""): Promise<boolean> => {
      if (issue === root) {
        if (note !== "" && (event === "merge conflict" || OUTCOMES.some((outcome) => outcome === event))) comment(issue, note);
        return true;
      }
      const action = next(status(issue), event);
      switch (action.type) {
        case "refuse":
          log.info(`  #${issue} ${event} refused: ${action.reason}`);
          return false;
        case "close":
          gh("issue", "close", `${issue}`, "--repo", home.slug, "--reason", action.reason, "--comment", [DISCLAIMER, note, takeLine(branch)].filter((part) => part !== "").join("\n\n"));
          await waitFor(issue, (current) => current === "Done", "Done", `switch on the built-in workflow "Item closed" (Status Done)`);
          log.info(`  #${issue} closed ${action.reason}`);
          return true;
        case "set":
          if (note !== "") comment(issue, note);
          put(issue, action.status);
          log.info(`  #${issue} -> ${action.status}`);
          return true;
        case "reopen":
          gh("issue", "reopen", `${issue}`, "--repo", home.slug);
          await waitFor(issue, (current) => current === "Ready for agent", "Ready for agent", `switch on the built-in workflow "Item reopened" (Status Ready for agent)`);
          log.info(`  #${issue} reopened`);
          return true;
      }
    };
    // The built-in Item added workflow sets Backlog on add, asynchronously: wait until the item shows a Status, so this write lands last.
    // An issue already past Backlog is a retry: the machine refuses `created`, which skips it.
    const ready = async (issues: readonly number[]): Promise<void> => {
      for (const issue of issues) {
        add(issue);
        await waitFor(issue, (current) => current !== null, "a Status", `switch on its built-in workflow "Item added to project" (Status Backlog)`);
        await move(issue, "created");
      }
    };
    return { move, ready, subIssues, inStatus };
  };

  const rootTarget = (event: Event): Status => {
    const action = next(status(root), event);
    if (action.type !== "set") throw new Error(`#${root} cannot ${event}: ${action.type === "refuse" ? action.reason : action.type}.`);
    return action.status;
  };
  const shift = (event: Event): void => {
    const to = rootTarget(event);
    put(root, to);
    log.info(`#${root} -> ${to}`);
  };

  // R3 from In review: closes the old take's open PRs and reopens the sub-issues it closed (S7). Before the new take's branch is named:
  // an open PR of the old take stops it.
  const closeOldTake = async (): Promise<void> => {
    const old = latestTake(workspace, root).branch;
    for (const repo of workspace.repos) {
      const urls = prsSchema.parse(JSON.parse(sh(repo.path, "gh", "pr", "list", "--repo", repo.slug, "--head", old, "--state", "open", "--json", "url")));
      for (const { url } of urls) {
        sh(repo.path, "gh", "pr", "close", url, "--comment", `${DISCLAIMER}\n\nClosed: a new take of #${root} starts from scratch.`);
        log.info(`${url} closed`);
      }
    }
    const kanban = at(old);
    for (const issue of subIssues()) {
      const view = viewSchema.parse(JSON.parse(gh("issue", "view", `${issue}`, "--repo", home.slug, "--json", "state,comments")));
      if (view.state === "CLOSED" && view.comments.some(({ body }) => body.split("\n").includes(takeLine(old)))) await kanban.move(issue, "retake");
    }
  };

  const run: KanbanRun["run"] = async (event, branchOf, work) => {
    const from = status(root);
    rootTarget(event);
    if (event === "take" && from === "In review") await closeOldTake();
    const branch = branchOf();
    const kanban = at(branch);
    const sweep = async (): Promise<void> => {
      for (const issue of kanban.inStatus("Agent working")) await kanban.move(issue, "crashed");
    };
    shift(event);
    await sweep();
    const result = await work(kanban, branch).catch(async (error: unknown) => {
      await sweep().catch((sweepError: unknown) => log.error(`Could not return the Agent working sub-issues: ${message(sweepError)}`));
      throw error;
    });
    if (result.pr) shift("pr opened");
    else {
      shift("run ended without pr");
      comment(root, `The run ended without a PR; this issue is back in Backlog.\n\n${result.text}`);
    }
    return result.text;
  };

  return { run };
};
