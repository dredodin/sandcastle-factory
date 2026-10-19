import { fileURLToPath } from "node:url";

// A phase's prompt, as an absolute path: sandcastle resolves prompt files against the process's directory, not the factory's.
export const promptPath = (phase: "plan" | "implement" | "review" | "merge" | "pr"): string =>
  fileURLToPath(new URL(`../phases/${phase}/prompt.md`, import.meta.url));
