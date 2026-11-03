// The run's in-memory record: review reports, findings the plan rejected, PR comments it handled, items that were merged. Nothing is persisted; a resume starts empty.
import type { Handled } from "./comments.mjs";
import type { Item } from "./item.mjs";

export type Rejection = { readonly finding: string; readonly reason: string };

// An item merged into the integration branch, with the commit that carries it.
export type Merged = { readonly item: Item; readonly commit: string };

export type RunRecord = {
  // The reports of the last review pass: repo name → report ("" when it found nothing).
  readonly setReports: (reports: ReadonlyMap<string, string>) => void;
  readonly reports: () => ReadonlyMap<string, string>;
  readonly reject: (rejections: readonly Rejection[]) => void;
  // Every finding rejected so far in the run.
  readonly rejected: () => readonly Rejection[];
  // Items merged into the integration branch.
  readonly merged: (items: readonly Merged[]) => void;
  readonly mergedItems: () => readonly Merged[];
  // PR comments the plan handled, for the rest of the run.
  readonly handle: (comments: readonly Handled[]) => void;
  readonly handled: () => readonly Handled[];
};

export const openRecord = (): RunRecord => {
  const state = { reports: new Map<string, string>() as ReadonlyMap<string, string>, rejected: [] as readonly Rejection[], merged: [] as readonly Merged[], handled: [] as readonly Handled[] };
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
  rejected.length === 0 ? "(none)" : rejected.map(({ finding, reason }) => `- ${finding} — rejected: ${reason}`).join("\n");
