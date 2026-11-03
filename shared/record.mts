// The run's in-memory record: review reports, findings the plan rejected, items that were merged. Nothing is persisted; a resume starts empty.
import type { Item } from "./item.mjs";

export type Rejection = { readonly finding: string; readonly reason: string };

export type RunRecord = {
  // The reports of the last review pass: repo name → report ("" when it found nothing).
  readonly setReports: (reports: ReadonlyMap<string, string>) => void;
  readonly reports: () => ReadonlyMap<string, string>;
  readonly reject: (rejections: readonly Rejection[]) => void;
  // Every finding rejected so far in the run.
  readonly rejected: () => readonly Rejection[];
  // Items merged into the integration branch.
  readonly merged: (items: readonly Item[]) => void;
  readonly mergedItems: () => readonly Item[];
  // Items planned and not merged (conflict, ended without code).
  readonly leftOut: (items: readonly Item[]) => void;
  readonly leftOutItems: () => readonly Item[];
  // Every pass's report, kept for the PR description.
  readonly reviewed: (reports: ReadonlyMap<string, string>) => void;
  readonly reviewedRepos: () => ReadonlySet<string>;
};

export const openRecord = (): RunRecord => {
  const state = { reports: new Map<string, string>() as ReadonlyMap<string, string>, rejected: [] as readonly Rejection[], merged: [] as readonly Item[], left: [] as readonly Item[], reviewed: new Set<string>() };
  return {
    setReports: (reports) => {
      state.reports = reports;
    },
    reports: () => state.reports,
    reject: (more) => {
      state.rejected = [...state.rejected, ...more];
    },
    rejected: () => state.rejected,
    merged: (items) => {
      state.merged = [...state.merged, ...items];
    },
    mergedItems: () => state.merged,
    leftOut: (items) => {
      state.left = [...state.left, ...items];
    },
    leftOutItems: () => state.left,
    reviewed: (reports) => {
      for (const [repo, report] of reports) if (report !== "") state.reviewed.add(repo);
    },
    reviewedRepos: () => state.reviewed,
  };
};

// Prompt text for the reports of a pass: one block per repo with findings.
export const reportsText = (reports: ReadonlyMap<string, string>): string => {
  const found = [...reports].filter(([, report]) => report !== "");
  return found.length === 0 ? "(none)" : found.map(([repo, report]) => `### ${repo}\n\n${report}`).join("\n\n");
};

// Prompt text for rejected findings.
export const rejectedText = (rejected: readonly Rejection[]): string =>
  rejected.length === 0 ? "(none)" : rejected.map(({ finding, reason }) => `- ${finding} — rejected: ${reason}`).join("\n");
