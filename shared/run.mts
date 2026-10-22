import { appendFileSync } from "node:fs";
import type { AgentProvider } from "@ai-hero/sandcastle";
import type { Agents } from "./agents.mjs";
import type { Phase } from "./env.mjs";
import type { Item } from "./item.mjs";
import type { Integrations, SandboxContext } from "./sandbox.mjs";
import type { Repo, Workspace } from "./workspace.mjs";

// What every stage of one run shares: who runs, for which root issue, on which integration branch.
export type Run = {
  readonly agents: Agents;
  readonly context: SandboxContext;
  readonly workspace: Workspace;
  readonly root: number;
  readonly title: string;
  readonly branch: string;
  // One integration worktree per repo, opened the first time the repo is needed.
  readonly integrations: Integrations;
  readonly logDir: string;
};

// A run at one planning cycle.
export type Cycle = Run & { readonly number: number };

// First line of every comment an agent posts under the maintainer's account; comments starting with it are never requests.
export const DISCLAIMER = "> *Sandcastle agent reply — not a request.*";

// What the planner decides for one cycle: the repos whose default branch must be merged first, and the items to work.
export type Plan = { readonly defaults: readonly Repo[]; readonly items: readonly Item[] };

// A phase's agent and where it logs: one file per agent run, inside the run's own log folder,
// starting with the provider, model and effort the phase runs with.
export const phaseAgent = (
  run: Pick<Run, "agents" | "context" | "logDir">,
  phase: Phase,
  name: string,
): { readonly agent: AgentProvider; readonly logging: { readonly type: "file"; readonly path: string } } => {
  const path = `${run.logDir}/${name}.log`;
  const { provider, model, effort } = run.context.env.phases[phase];
  appendFileSync(path, `${phase}: ${provider} ${model}, effort ${effort}\n`);
  return { agent: run.agents[phase], logging: { type: "file", path } };
};

// Seconds an agent may stay silent before its run fails; a repo's checks (verify, mutation runs) can outlast sandcastle's 600.
export const IDLE_TIMEOUT_SECONDS = 3600;
