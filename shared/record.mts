// The run's in-memory record: review reports, findings the plan rejected, PR comments it handled, items merged or left out, repos whose reviews found something. Nothing is persisted; a resume starts empty.
import type { Handled } from "./comments.mjs";
import type { Item } from "./item.mjs";

// A review finding the plan rejected, with the repo whose report it came from.
export type Rejection = { readonly repo: string; readonly finding: string; readonly reason: string };

// An item merged into the integration branch, with its merge commit ("" when git did not show one).
export type Merged = { readonly item: Item; readonly commit: string };

export type RunRecord = {
  // The reports of the last review pass: repo name → report ("" when it found nothing).
  readonly setReports: (reports: ReadonlyMap<string, string>) => void;
  readonly reports: () => ReadonlyMap<string, string>;
  readonly reject: (rejections: readonly Rejection[]) => void;
  // Every finding rejected so far in the run.
  readonly rejected: () => readonly Rejection[];
  readonly addMerged: (items: readonly Merged[]) => void;
  // Items merged into the integration branch.
  readonly merged: () => readonly Merged[];
  readonly addLeftOut: (items: readonly Item[]) => void;
  // Items planned and not merged (conflict, ended without code).
  readonly leftOut: () => readonly Item[];
  readonly noteFindings: (reports: ReadonlyMap<string, string>) => void;
  // Repos whose report had findings in any pass, for the PR description.
  readonly reposWithFindings: () => ReadonlySet<string>;
  // PR comments the plan handled, for the rest of the run.
  readonly handle: (comments: readonly Handled[]) => void;
  readonly handled: () => readonly Handled[];
};

export const openRecord = (): RunRecord => {
  const state = { reports: new Map<string, string>() as ReadonlyMap<string, string>, rejected: [] as readonly Rejection[], merged: [] as readonly Merged[], left: [] as readonly Item[], withFindings: new Set<string>(), handled: [] as readonly Handled[] };
  return {
    setReports: (reports) => {
      state.reports = reports;
    },
    reports: () => state.reports,
    reject: (more) => {
      state.rejected = [...state.rejected, ...more];
    },
    rejected: () => state.rejected,
    addMerged: (items) => {
      state.merged = [...state.merged, ...items];
    },
    merged: () => state.merged,
    addLeftOut: (items) => {
      state.left = [...state.left, ...items];
    },
    leftOut: () => state.left,
    noteFindings: (reports) => {
      for (const [repo, report] of reports) if (report !== "") state.withFindings.add(repo);
    },
    reposWithFindings: () => state.withFindings,
    handle: (more) => {
      state.handled = [...state.handled, ...more];
    },
    handled: () => state.handled,
  };
};

// Prompt text for the reports of a pass: one block per repo with findings.
export const reportsText = (reports: ReadonlyMap<string, string>): string => {
  const found = [...reports].filter(([, report]) => report !== "");
  return found.length === 0 ? "(none)" : found.map(([repo, report]) => `### ${repo}\n\n${report}`).join("\n\n");
};

// Prompt text for rejected findings.
export const rejectedText = (rejected: readonly Rejection[]): string =>
  rejected.length === 0 ? "(none)" : rejected.map(({ repo, finding, reason }) => `- ${repo}: ${finding} — rejected: ${reason}`).join("\n");
