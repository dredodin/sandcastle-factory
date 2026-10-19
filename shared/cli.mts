// The process edge: arguments in, exit code out.

import type { Mode } from "./branches.mjs";
import { log } from "./logger.mjs";

export const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export const fail = (failure: string): never => {
  log.error(failure);
  return process.exit(1);
};

export type Command = { readonly mode: Mode; readonly root: number } | { readonly mode: "setup" };

export const parseArgs = (argv: readonly string[]): Command => {
  const [mode, issue = "", ...extra] = argv;
  if (mode === "setup" && issue === "" && extra.length === 0) return { mode };
  if ((mode === "take" || mode === "resume") && extra.length === 0 && /^[1-9][0-9]*$/.test(issue)) return { mode, root: Number(issue) };
  console.error("Usage: npm run sandcastle -- <setup | take <issue> | resume <issue>>");
  return process.exit(2);
};
