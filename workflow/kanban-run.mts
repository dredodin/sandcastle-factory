// The root issue's card over one run: checked before the run, moved by the state machine at its start and end.

import { z } from "zod";
import type { Env } from "../shared/env.mjs";
import { preflight, reopensOldTake, rootAction, subAction, type Kanban, type RootEvent, type Status } from "../shared/kanban.mjs";
import { closedByTakeOf, comment, readBoard, readStatus, reopenIssue, setStatus, subIssues, type BoardRead } from "../shared/kanban-gh.mjs";
import { log } from "../shared/logger.mjs";
import { message } from "../shared/cli.mjs";
import { latestTake } from "../shared/repo.mjs";
import { DISCLAIMER } from "../shared/run.mjs";
import { sh } from "../shared/shell.mjs";
import type { Repo, Workspace } from "../shared/workspace.mjs";

export type Card = { readonly workspace: Workspace; readonly home: Repo; readonly kanban: Kanban; readonly board: BoardRead; readonly root: number };

// What a run came to: its report, and whether it opened or updated a PR.
export type RunResult = { readonly text: string; readonly pr: boolean };

const readOrThrow = (home: Repo, kanban: Kanban): BoardRead => {
  try {
    return readBoard(home, kanban);
  } catch (error) {
    throw new Error(`The Kanban ${kanban.owner}/${kanban.number} cannot be read: ${message(error)}. Check KANBAN_OWNER, KANBAN_NUMBER and that GH_TOKEN is a classic token with repo, project, workflow, read:org, read:discussion.`);
  }
};

// The Status the event moves the root's card to; a refusal throws.
const decide = (card: Card, event: RootEvent): Status => {
  const action = rootAction(readStatus(card.home, card.board, card.root), event);
  if (action.type === "refuse") throw new Error(`#${card.root} cannot ${event}: ${action.reason}.`);
  return action.status;
};

const move = (card: Card, event: RootEvent): void => {
  const status = decide(card, event);
  setStatus(card.home, card.kanban, card.board, card.root, status);
  log.info(`#${card.root} -> ${status}`);
};

// Refuses the run, naming what to fix, when the Kanban cannot run the machine or the root's card may not start it. Writes nothing.
export const gate = (workspace: Workspace, env: Env, root: number, event: "take" | "resume"): Card => {
  const { home } = workspace;
  const board = readOrThrow(home, env.kanban);
  const problems = preflight(board);
  if (problems.length > 0) throw new Error(`The Kanban ${env.kanban.owner}/${env.kanban.number} cannot run the factory:\n${problems.map((problem) => `- ${problem}`).join("\n")}`);
  const card = { workspace, home, kanban: env.kanban, board, root };
  decide(card, event);
  return card;
};

const endWithoutPr = (card: Card, reason: string): void => {
  move(card, "endedWithoutPr");
  comment(card.home, card.root, `${DISCLAIMER}\n\nThe run ended without a PR; this issue is back in Backlog.\n\n${reason}`);
};

// Returns the root's Agent working sub-issues to Ready for agent (S6): work nobody is doing. A process killed mid-run leaves them.
const sweep = (card: Card): void => {
  for (const issue of subIssues(card.home, card.root)) {
    const action = subAction(readStatus(card.home, card.board, issue), "crashed");
    if (action.type !== "set") continue;
    setStatus(card.home, card.kanban, card.board, issue, action.status);
    log.info(`#${issue} -> ${action.status}`);
  }
};

// R3 from In review: closes the old take's open PRs and reopens the sub-issues it closed (S7). Before the new take's branch is named:
// an open PR of the old take stops it.
export const closeOldTake = async (card: Card): Promise<void> => {
  if (!reopensOldTake(readStatus(card.home, card.board, card.root))) return;
  const { workspace, home, board, root } = card;
  const old = latestTake(workspace, root).branch;
  for (const repo of workspace.repos) {
    const urls = z.array(z.object({ url: z.string() })).parse(JSON.parse(sh(repo.path, "gh", "pr", "list", "--repo", repo.slug, "--head", old, "--state", "open", "--json", "url")));
    for (const { url } of urls) {
      sh(repo.path, "gh", "pr", "close", url, "--comment", `${DISCLAIMER}\n\nClosed: a new take of #${root} starts from scratch.`);
      log.info(`${url} closed`);
    }
  }
  for (const issue of subIssues(home, root)) {
    if (!closedByTakeOf(home, issue, old)) continue;
    const action = subAction(readStatus(home, board, issue), "retake");
    if (action.type !== "reopen") continue;
    await reopenIssue(home, board, issue);
    log.info(`#${issue} reopened`);
  }
};

// Moves the root to Agent working, runs `work`, then to In review when it opened a PR, else to Backlog with the reason in a comment.
// Sub-issues left in Agent working are swept at the start and on a throw,
// which leaves the root in Agent working: `resume` continues from there.
export const tracked = async (card: Card, event: "take" | "resume", work: () => Promise<RunResult>): Promise<string> => {
  move(card, event);
  sweep(card);
  const outcome = await work().catch((error: unknown) => {
    try {
      sweep(card);
    } catch (sweepError) {
      log.error(`Could not return the Agent working sub-issues: ${message(sweepError)}`);
    }
    throw error;
  });
  if (outcome.pr) move(card, "prOpened");
  else endWithoutPr(card, outcome.text);
  return outcome.text;
};
