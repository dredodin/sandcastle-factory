import { fileURLToPath } from "node:url";

type Phase = "plan" | "implement" | "review" | "merge" | "pr";

// A phase's file, as an absolute path: sandcastle resolves prompt files against the process's directory, not the factory's.
const phaseFile = (phase: Phase, file: string): string => fileURLToPath(new URL(`../phases/${phase}/${file}`, import.meta.url));

export const promptPath = (phase: Phase): string => phaseFile(phase, "prompt.md");

// The plan's follow-up prompt, for a cycle that resumes the last plan session.
export const planResumePath = (): string => phaseFile("plan", "resume.md");
