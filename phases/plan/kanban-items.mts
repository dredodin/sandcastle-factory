// The sub-issues' cards over a cycle: new issues born Ready for agent, planned items to Agent working, merged ones closed.

import type { Item } from "../../shared/item.mjs";
import { subAction, type SubAction, type SubEvent } from "../../shared/kanban.mjs";
import { addReady, closeIssue, readBoard, readStatus, setStatus, subIssues, type BoardRead } from "../../shared/kanban-gh.mjs";
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

// Closes the sub-issues whose work is merged into the integration branch; the comment names the take.
export const closeMerged = (cycle: Cycle, items: readonly Item[]): void => {
  const { home } = cycle.workspace;
  const board = readBoard(home, cycle.context.env.kanban);
  for (const { item, action } of decided(cycle, board, items, "merged")) {
    if (action.type !== "close") {
      log.info(`  #${item.issue} merged, not closed: ${action.type === "refuse" ? action.reason : action.type}`);
      continue;
    }
    closeIssue(home, Number(item.issue), action.reason, `${DISCLAIMER}\n\nDone: merged into \`${cycle.branch}\`.`);
    log.info(`  #${item.issue} closed`);
  }
};
