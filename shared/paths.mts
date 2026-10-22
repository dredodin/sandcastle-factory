import { fileURLToPath } from "node:url";

// A phase's prompt, as an absolute path: sandcastle resolves prompt files against the process's directory, not the factory's.
const phaseFile = (phase: string, file: string): string => fileURLToPath(new URL(`../phases/${phase}/${file}`, import.meta.url));

export const promptPath = (phase: "plan" | "implement" | "review" | "merge" | "pr"): string => phaseFile(phase, "prompt.md");

// The plan's follow-up prompt, for a cycle that resumes the last plan session.
export const planResumePath = (): string => phaseFile("plan", "resume.md");
