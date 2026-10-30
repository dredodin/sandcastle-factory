import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

// A phase's prompt, as an absolute path: sandcastle resolves prompt files against the process's directory, not the factory's.
export const promptPath = (phase: "plan" | "implement" | "review" | "merge" | "pr"): string =>
  fileURLToPath(new URL(`../phases/${phase}/prompt.md`, import.meta.url));

// The host's Codex login file (`codex login`).
export const hostCodexLogin = (): string => `${homedir()}/.codex/auth.json`;
// Where the sandbox mounts it, under the agent's home.
export const SANDBOX_CODEX_LOGIN = "/home/agent/.codex/auth.json";
