import type { Item } from "./item.mjs";

const SUBJECT = "SANDCASTLE: merge ";
const TRAILER = "Issue: #";

// The `-m` messages of an item's merge commit.
export const messagesFor = (item: Item): readonly string[] => [`${SUBJECT}#${item.issue}`, `${TRAILER}${item.issue}`];

// The merge command the merge script runs and the merge prompt lists, verbatim.
export const mergeCommand = (branch: string, messages: readonly string[]): string =>
  `git merge --no-ff ${branch} ${messages.map((m) => `-m "${m}"`).join(" ")}`;

// Issue numbers the merge-commit messages record, each once, in first-seen order.
export const issuesIn = (messages: readonly string[]): readonly number[] => {
  const ids = messages.flatMap((message) => {
    const id = new RegExp(`^${SUBJECT}#([0-9]+)$`, "m").exec(message)?.[1] ?? new RegExp(`^${TRAILER}([0-9]+)$`, "m").exec(message)?.[1];
    return id === undefined ? [] : [Number(id)];
  });
  return [...new Set(ids)];
};
