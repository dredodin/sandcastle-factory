// The sub-issues' cards: moves go through `apply`. New issues are born Ready for agent, planned items go to Agent working,
// settled ones are closed or sent to Backlog.

import type { Item } from "./item.mjs";
import { subAction, takeLine, type SubAction, type SubEvent } from "./kanban.mjs";
import { addReady, closeIssue, comment, readStatus, reopenIssue, setStatus, subIssues, type KanbanHandle } from "./kanban-gh.mjs";
import { log } from "./logger.mjs";
import { DISCLAIMER, type Cycle, type Run } from "./run.mjs";

// What the machine does for the event, done: a close carries a comment naming the take, a move to Backlog or back carries the note
// when there is one. A refusal is logged. Resolves to the action.
export const apply = async (kanban: KanbanHandle, issue: number, event: SubEvent, note: string, branch: string): Promise<SubAction> => {
  const action = subAction(readStatus(kanban, issue), event);
  switch (action.type) {
    case "refuse":
      log.info(`  #${issue} ${event} refused: ${action.reason}`);
      break;
    case "close":
      closeIssue(kanban, issue, action.reason, `${DISCLAIMER}\n\n${note}\n\n${takeLine(branch)}`);
      log.info(`  #${issue} closed ${action.reason}`);
      break;
    case "set":
      if (note !== "") comment(kanban, issue, `${DISCLAIMER}\n\n${note}`);
      setStatus(kanban, issue, action.status);
      log.info(`  #${issue} -> ${action.status}`);
      break;
    case "reopen":
      await reopenIssue(kanban, issue);
      log.info(`  #${issue} reopened`);
      break;
  }
  return action;
};

// Adds the issues to the Kanban in Ready for agent.
export const readyCreated = async (kanban: KanbanHandle, created: readonly number[]): Promise<void> => {
  for (const issue of created) await addReady(kanban, issue);
};

// The root's sub-issues, to tell the ones filed since.
export const subIssuesOf = (run: Pick<Run, "kanban" | "root">): readonly number[] => subIssues(run.kanban, run.root);

// Readies the root's sub-issues that are not in `before`.
export const readyNewSince = (run: Run, before: readonly number[]): Promise<void> =>
  readyCreated(run.kanban, subIssuesOf(run).filter((issue) => !before.includes(issue)));

// Moves the planned sub-issues to Agent working; a refused one is dropped. The root as item has no card and stays.
export const startItems = async (cycle: Cycle, items: readonly Item[]): Promise<readonly Item[]> => {
  const started = await Promise.all(
    items.filter((item) => Number(item.issue) !== cycle.root).map(async (item) => ({ item, action: await apply(cycle.kanban, Number(item.issue), "planned", "", cycle.branch) })),
  );
  const kept = started.filter(({ action }) => action.type === "set").map(({ item }) => item);
  return items.filter((item) => Number(item.issue) === cycle.root || kept.includes(item));
};

// What happened to one item, with the words for its comment.
export type Settled = { readonly item: Item; readonly event: SubEvent; readonly note: string };

// Applies the machine to settled sub-issues. The root as item has no card.
export const settle = async (cycle: Cycle, settled: readonly Settled[]): Promise<void> => {
  for (const { item, event, note } of settled.filter(({ item }) => Number(item.issue) !== cycle.root)) {
    await apply(cycle.kanban, Number(item.issue), event, note, cycle.branch);
  }
};

// Closes the sub-issues whose work is merged into the integration branch.
export const closeMerged = (cycle: Cycle, items: readonly Item[]): Promise<void> =>
  settle(cycle, items.map((item) => ({ item, event: "merged", note: `Done: merged into \`${cycle.branch}\`.` })));

// Sub-issues of the root that sit in Backlog.
export const backlogged = (run: Run): readonly number[] => subIssuesOf(run).filter((issue) => readStatus(run.kanban, issue) === "Backlog");
