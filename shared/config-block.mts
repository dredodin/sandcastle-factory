import type { PhaseSettings } from "./agents.mjs";
import type { Mode } from "./branches.mjs";

export type ConfigBlock = {
  readonly mode: Mode;
  readonly root: number;
  readonly title: string;
  readonly branch: string;
  readonly logDir: string;
  readonly repos: readonly string[];
  readonly sandbox: string;
  readonly settings: readonly PhaseSettings[];
  readonly maxCycles: number;
};

const pad = (cells: readonly string[], widths: readonly number[]): string =>
  cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  ").trimEnd();

// The first thing a run logs: what it is, where it writes, what runs each phase. Never a token or key.
export const configBlock = (config: ConfigBlock): string => {
  const rows = [["phase", "provider", "model", "effort"], ...config.settings.map((s) => [s.phase, s.provider, s.model, s.effort])];
  const widths = [0, 1, 2, 3].map((column) => Math.max(...rows.map((row) => row[column]!.length)));
  return [
    `${config.mode} #${config.root} — ${config.title}`,
    `branch: ${config.branch}`,
    `repos: ${config.repos.join(", ")}`,
    `sandbox: ${config.sandbox}`,
    `log folder: ${config.logDir}`,
    ...rows.map((row) => pad(row, widths)),
    `cycle cap: ${config.maxCycles}`,
  ].join("\n");
};
