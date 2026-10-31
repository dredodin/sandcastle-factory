// What an implement run reports: one outcome the harness maps to the sub-issue's move.

import type { SubEvent } from "./kanban.mjs";

export type ImplementOutcome = {
  readonly outcome: "committed" | "done without code" | "already done" | "findings rejected" | "cannot finish";
  readonly note: string;
};

// The event of an outcome without code; null for `committed`, whose work is merged first.
export const outcomeEvent = (outcome: ImplementOutcome["outcome"]): SubEvent | null => {
  switch (outcome) {
    case "committed":
      return null;
    case "done without code":
      return "doneWithoutCode";
    case "already done":
      return "alreadyDone";
    case "findings rejected":
      return "findingsRejected";
    case "cannot finish":
      return "cannotFinish";
  }
};

// The outcome of a run that printed none: its commits say it, else it could not finish.
export const missingOutcome = (commits: number): ImplementOutcome =>
  commits > 0 ? { outcome: "committed", note: "" } : { outcome: "cannot finish", note: "The implement run ended with no commits and reported no outcome." };

// The reported outcome checked against the commits: `committed` without any cannot be merged; work reported as done without code
// but committed is merged all the same.
export const reconcile = (reported: ImplementOutcome, commits: number): ImplementOutcome => {
  if (reported.outcome === "committed" && commits === 0) return { outcome: "cannot finish", note: "The implement run reported committed but made no commit." };
  if ((reported.outcome === "done without code" || reported.outcome === "already done") && commits > 0) return { outcome: "committed", note: reported.note };
  return reported;
};
