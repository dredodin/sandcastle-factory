// The sub-issues' cards over a cycle: new issues born Ready for agent, planned items to Agent working, settled ones closed or sent to Backlog.

import type { Item } from "../../shared/item.mjs";
import { subAction, takeLine, type SubAction, type SubEvent } from "../../shared/kanban.mjs";
import { addReady, closeIssue, comment, readBoard, readStatus, setStatus, subIssues, type BoardRead } from "../../shared/kanban-gh.mjs";
import { log } from "../../shared/logger.mjs";
import { DISCLAIMER, type Cycle, type Run } from "../../shared/run.mjs";

// Adds the issues to the Kanban in Ready for agent.
export const readyCreated = async (run: Pick<Run, "workspace" | "context">, created: readonly string[]): Promise<void> => {
  const { home } = run.workspace;
  const kanban = run.context.env.kanban;
  const board = readBoard(home, kanban);
  for (const issue of created) await addReady(home, kanban, board, Number(issue));
};

// Runs `work` (a review), then readies the root's sub-issues it filed.
export const readyFiled = async (run: Run, work: () => Promise<void>): Promise<void> => {
  const { home } = run.workspace;
  const before = subIssues(home, run.root);
  await work();
  await readyCreated(run, subIssues(home, run.root).filter((issue) => !before.includes(issue)).map(String));
};

// The sub-issues among `items` with what the machine does for `event`; the root as item has no card and is left out.
const decided = (cycle: Cycle, board: BoardRead, items: readonly Item[], event: SubEvent): readonly { readonly item: Item; readonly action: SubAction }[] =>
  items
    .filter((item) => Number(item.issue) !== cycle.root)
    .map((item) => ({ item, action: subAction(readStatus(cycle.workspace.home, board, Number(item.issue)), event) }));

// Moves the planned sub-issues to Agent working; a refused one is logged and dropped. The root as item stays.
export const startItems = (cycle: Cycle, items: readonly Item[]): readonly Item[] => {
  const { home } = cycle.workspace;
  const kanban = cycle.context.env.kanban;
  const board = readBoard(home, kanban);
  const kept = items.filter((item) => Number(item.issue) === cycle.root);
  for (const { item, action } of decided(cycle, board, items, "planned")) {
    if (action.type !== "set") {
      log.info(`  #${item.issue} planned refused: ${action.type === "refuse" ? action.reason : action.type}`);
      continue;
    }
    setStatus(home, kanban, board, Number(item.issue), action.status);
    kept.push(item);
  }
  return items.filter((item) => kept.includes(item));
};

// What happened to one item, with the words for its comment.
export type Settled = { readonly item: Item; readonly event: SubEvent; readonly note: string };

// Applies the machine to settled sub-issues: closes carry a comment naming the take, a move to Backlog or back carries the note.
// A refused one is logged. The root as item has no card.
export const settle = (cycle: Cycle, settled: readonly Settled[]): void => {
  const { home } = cycle.workspace;
  const kanban = cycle.context.env.kanban;
  const board = readBoard(home, kanban);
  for (const { item, event, note } of settled.filter(({ item }) => Number(item.issue) !== cycle.root)) {
    const issue = Number(item.issue);
    const action = subAction(readStatus(home, board, issue), event);
    if (action.type === "refuse") {
      log.info(`  #${item.issue} ${event} refused: ${action.reason}`);
      continue;
    }
    if (action.type === "close") {
      closeIssue(home, issue, action.reason, `${DISCLAIMER}\n\n${note}\n\n${takeLine(cycle.branch)}`);
      log.info(`  #${item.issue} closed ${action.reason}`);
      continue;
    }
    if (action.type === "set") {
      comment(home, issue, `${DISCLAIMER}\n\n${note}`);
      setStatus(home, kanban, board, issue, action.status);
      log.info(`  #${item.issue} -> ${action.status}`);
    }
  }
};

// Closes the sub-issues whose work is merged into the integration branch.
export const closeMerged = (cycle: Cycle, items: readonly Item[]): void =>
  settle(cycle, items.map((item) => ({ item, event: "merged", note: `Done: merged into \`${cycle.branch}\`.` })));

// Sub-issues of the root that sit in Backlog.
export const backlogged = (run: Run): readonly number[] => {
  const { home } = run.workspace;
  const board = readBoard(home, run.context.env.kanban);
  return subIssues(home, run.root).filter((issue) => readStatus(home, board, issue) === "Backlog");
};
