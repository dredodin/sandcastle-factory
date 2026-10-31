// The root issue's card over one run: checked before the run, moved by the state machine at its start and end.

import type { Env } from "../shared/env.mjs";
import { rootAction, preflight, type Kanban, type RootEvent, type Status } from "../shared/kanban.mjs";
import { comment, readBoard, readStatus, setStatus, type BoardRead } from "../shared/kanban-gh.mjs";
import { log } from "../shared/logger.mjs";
import { message } from "../shared/cli.mjs";
import { DISCLAIMER } from "../shared/run.mjs";
import type { Repo, Workspace } from "../shared/workspace.mjs";

export type Card = { readonly home: Repo; readonly kanban: Kanban; readonly board: BoardRead; readonly root: number };

// What a run came to: its report, and whether it opened or updated a PR.
export type Outcome = { readonly text: string; readonly pr: boolean };

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
  const card = { home, kanban: env.kanban, board, root };
  decide(card, event);
  return card;
};

const endWithoutPr = (card: Card, reason: string): void => {
  move(card, "endedWithoutPr");
  comment(card.home, card.root, `${DISCLAIMER}\n\nThe run ended without a PR; this issue is back in Backlog.\n\n${reason}`);
};

// Moves the root to Agent working, runs `work`, then to In review when it opened a PR, else to Backlog with the reason in a comment.
// A throw leaves it in Agent working: `resume` continues from there.
export const tracked = async (card: Card, event: "take" | "resume", work: () => Promise<Outcome>): Promise<string> => {
  move(card, event);
  const outcome = await work();
  if (outcome.pr) move(card, "prOpened");
  else endWithoutPr(card, outcome.text);
  return outcome.text;
};
