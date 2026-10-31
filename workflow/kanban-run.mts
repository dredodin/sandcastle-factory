// The root issue's card over one run: checked before the run, moved by the state machine at its start and end.

import { z } from "zod";
import type { Env } from "../shared/env.mjs";
import { preflight, reopensOldTake, rootAction, type Kanban, type RootEvent, type Status } from "../shared/kanban.mjs";
import { closedByTakeOf, comment, readKanban, readStatus, setStatus, subIssues, type KanbanHandle } from "../shared/kanban-gh.mjs";
import { log } from "../shared/logger.mjs";
import { message } from "../shared/cli.mjs";
import { latestTake } from "../shared/repo.mjs";
import { DISCLAIMER } from "../shared/run.mjs";
import { sh } from "../shared/shell.mjs";
import type { Workspace } from "../shared/workspace.mjs";
import { apply } from "../shared/kanban-moves.mjs";

export type Card = { readonly workspace: Workspace; readonly kanban: KanbanHandle; readonly root: number };

// What a run came to: its report, and whether it opened or updated a PR.
export type RunResult = { readonly text: string; readonly pr: boolean };

const readOrThrow = (workspace: Workspace, kanban: Kanban): KanbanHandle => {
  try {
    return readKanban(workspace.home, kanban);
  } catch (error) {
    throw new Error(`The Kanban ${kanban.owner}/${kanban.number} cannot be read: ${message(error)}. Check KANBAN_OWNER, KANBAN_NUMBER and that GH_TOKEN is a classic token with repo, project, workflow, read:org, read:discussion.`);
  }
};

// The Status the event moves the root's card to; a refusal throws.
const decide = (card: Card, event: RootEvent): Status => {
  const action = rootAction(readStatus(card.kanban, card.root), event);
  if (action.type === "refuse") throw new Error(`#${card.root} cannot ${event}: ${action.reason}.`);
  return action.status;
};

const move = (card: Card, event: RootEvent): void => {
  const status = decide(card, event);
  setStatus(card.kanban, card.root, status);
  log.info(`#${card.root} -> ${status}`);
};

// Refuses the run, naming what to fix, when the Kanban cannot run the machine or the root's card may not start it. Writes nothing.
export const gate = (workspace: Workspace, env: Env, root: number, event: "take" | "resume"): Card => {
  const kanban = readOrThrow(workspace, env.kanban);
  const problems = preflight(kanban);
  if (problems.length > 0) throw new Error(`The Kanban ${env.kanban.owner}/${env.kanban.number} cannot run the factory:\n${problems.map((problem) => `- ${problem}`).join("\n")}`);
  const card = { workspace, kanban, root };
  decide(card, event);
  return card;
};

const endWithoutPr = (card: Card, reason: string): void => {
  move(card, "endedWithoutPr");
  comment(card.kanban, card.root, `${DISCLAIMER}\n\nThe run ended without a PR; this issue is back in Backlog.\n\n${reason}`);
};

// Returns the root's Agent working sub-issues to Ready for agent (S6): work nobody is doing. A process killed mid-run leaves them.
const sweep = async (card: Card, branch: string): Promise<void> => {
  for (const issue of subIssues(card.kanban, card.root)) {
    if (readStatus(card.kanban, issue) === "Agent working") await apply(card.kanban, issue, "crashed", "", branch);
  }
};

// R3 from In review: closes the old take's open PRs and reopens the sub-issues it closed (S7). Before the new take's branch is named:
// an open PR of the old take stops it.
export const closeOldTake = async (card: Card): Promise<void> => {
  const { workspace, kanban, root } = card;
  if (!reopensOldTake(readStatus(kanban, root))) return;
  const old = latestTake(workspace, root).branch;
  for (const repo of workspace.repos) {
    const urls = z.array(z.object({ url: z.string() })).parse(JSON.parse(sh(repo.path, "gh", "pr", "list", "--repo", repo.slug, "--head", old, "--state", "open", "--json", "url")));
    for (const { url } of urls) {
      sh(repo.path, "gh", "pr", "close", url, "--comment", `${DISCLAIMER}\n\nClosed: a new take of #${root} starts from scratch.`);
      log.info(`${url} closed`);
    }
  }
  for (const issue of subIssues(kanban, root)) {
    if (closedByTakeOf(kanban, issue, old)) await apply(kanban, issue, "retake", "", old);
  }
};

// Moves the root to Agent working, runs `work`, then to In review when it opened a PR, else to Backlog with the reason in a comment.
// Sub-issues left in Agent working are swept at the start and on a throw,
// which leaves the root in Agent working: `resume` continues from there.
export const tracked = async (card: Card, event: "take" | "resume", branch: string, work: () => Promise<RunResult>): Promise<string> => {
  move(card, event);
  await sweep(card, branch);
  const outcome = await work().catch(async (error: unknown) => {
    await sweep(card, branch).catch((sweepError: unknown) => log.error(`Could not return the Agent working sub-issues: ${message(sweepError)}`));
    throw error;
  });
  if (outcome.pr) move(card, "prOpened");
  else endWithoutPr(card, outcome.text);
  return outcome.text;
};
