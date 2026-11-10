// The run's in-memory record: review reports, findings the plan rejected, PR comments it handled, how each item ended. Nothing is persisted; a resume starts empty.
import type { Handled } from "./comments.mjs";
import type { Item } from "./item.mjs";
import type { Outcome } from "./kanban.mjs";
import type { ReviewReport } from "./review-report.mjs";

// A review finding the plan rejected, with the repo whose report it came from.
export type Rejection = { readonly repo: string; readonly finding: string; readonly reason: string };

// An item merged into the integration branch, with its merge commit ("" when git did not show one).
export type Merged = { readonly item: Item; readonly commit: string };

export type Ended = { readonly item: Item; readonly end: Exclude<Outcome, "committed"> | "merge conflict" };

// `pass`: the review pass whose reports the plan worked from when the entry was recorded; 0 before the first pass.
type Stamped<T> = T & { readonly pass: number };

// What the PR description's review section is read from. Items carry their pass: only the last pass's left-over items are unsettled.
export type ReviewRecord = {
  readonly rejected: readonly Rejection[];
  readonly merged: readonly Stamped<Merged>[];
  readonly ended: readonly Stamped<Ended>[];
};

export type RunRecord = {
  // A review pass's reports (the plan reads them until `clearReports`) and its Review notes (kept for the PR phase, never planned).
  readonly addPass: (pass: ReadonlyMap<string, Pick<ReviewReport, "report" | "notes">>) => void;
  readonly notes: () => ReadonlyMap<string, string>;
  readonly clearReports: () => void;
  readonly reports: () => ReadonlyMap<string, string>;
  readonly reject: (rejections: readonly Rejection[]) => void;
  readonly rejected: () => readonly Rejection[];
  readonly addMerged: (items: readonly Merged[]) => void;
  readonly merged: () => readonly Merged[];
  readonly addEnded: (items: readonly Ended[]) => void;
  // A comment handled again replaces its earlier entry: one reply per comment.
  readonly handle: (comments: readonly Handled[]) => void;
  readonly handled: () => readonly Handled[];
  readonly review: () => ReviewRecord;
};

export const openRecord = (): RunRecord => {
  const state = {
    pass: new Map() as ReadonlyMap<string, Pick<ReviewReport, "report" | "notes">>,
    cleared: false,
    passes: 0,
    rejected: [] as ReviewRecord["rejected"],
    merged: [] as ReviewRecord["merged"],
    ended: [] as ReviewRecord["ended"],
    handled: [] as readonly Handled[],
  };
  const stamp = <T,>(entries: readonly T[]): readonly Stamped<T>[] => entries.map((entry) => ({ ...entry, pass: state.passes }));
  return {
    addPass: (pass) => {
      state.pass = pass;
      state.cleared = false;
      state.passes += 1;
    },
    clearReports: () => {
      state.cleared = true;
    },
    reports: () => new Map(state.cleared ? [] : [...state.pass].map(([repo, { report }]) => [repo, report])),
    notes: () => new Map([...state.pass].map(([repo, { notes }]) => [repo, notes])),
    reject: (more) => {
      state.rejected = [...state.rejected, ...more];
    },
    rejected: () => state.rejected,
    addMerged: (items) => {
      state.merged = [...state.merged, ...stamp(items)];
    },
    merged: () => state.merged,
    addEnded: (items) => {
      state.ended = [...state.ended, ...stamp(items)];
    },
    handle: (more) => {
      state.handled = [...state.handled.filter(({ id }) => !more.some((comment) => comment.id === id)), ...more];
    },
    handled: () => state.handled,
    review: () => ({ rejected: state.rejected, merged: state.merged, ended: state.ended }),
  };
};

// How the cycle's items ended, from each one's implement outcome and the items the merge left out.
export const cycleEnds = (
  outcomes: readonly { readonly item: Item; readonly outcome: Outcome }[],
  leftOut: readonly Item[],
): { readonly merged: readonly Item[]; readonly ended: readonly Ended[] } => ({
  merged: outcomes.filter(({ item, outcome }) => outcome === "committed" && !leftOut.includes(item)).map(({ item }) => item),
  ended: outcomes.flatMap(({ item, outcome }): readonly Ended[] => {
    if (outcome !== "committed") return [{ item, end: outcome }];
    return leftOut.includes(item) ? [{ item, end: "merge conflict" }] : [];
  }),
});

// Prompt text for the reports of a pass: one block per repo with findings.
export const reportsText = (reports: ReadonlyMap<string, string>): string => {
  const found = [...reports].filter(([, report]) => report !== "");
  return found.length === 0 ? "(none)" : found.map(([repo, report]) => `### ${repo}\n\n${report}`).join("\n\n");
};

export const rejectedText = (rejected: readonly Rejection[]): string =>
  rejected.length === 0 ? "(none)" : rejected.map(({ repo, finding, reason }) => `- ${repo}: ${finding} — rejected: ${reason}`).join("\n");
