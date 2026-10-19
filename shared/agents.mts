import { claudeCode, copilot, type AgentProvider } from "@ai-hero/sandcastle";
import { PHASES, type Env, type Phase, type PhaseSetting } from "./env.mjs";

export type Agents = Readonly<Record<Phase, AgentProvider>>;
export type PhaseSettings = PhaseSetting & { readonly phase: Phase };

const EFFORTS = {
  claudeCode: ["low", "medium", "high", "xhigh", "max"],
  copilot: ["low", "medium", "high"],
} as const;

const effortOf = <E extends string,>({ phase, provider, effort }: PhaseSettings, levels: readonly E[]): E => {
  const level = levels.find((known) => known === effort);
  if (level === undefined) throw new Error(`${phase}_EFFORT=${effort} is not a ${provider} effort.`);
  return level;
};

const agentFor = (setting: PhaseSettings): AgentProvider =>
  setting.provider === "claudeCode"
    ? claudeCode(setting.model, { effort: effortOf(setting, EFFORTS.claudeCode) })
    : copilot(setting.model, { effort: effortOf(setting, EFFORTS.copilot) });

// The built agents, and the raw settings they were built from (no secrets: only provider, model, effort).
export const loadAgents = (env: Env): { readonly agents: Agents; readonly settings: readonly PhaseSettings[] } => {
  const settings = PHASES.map((phase) => ({ phase, ...env.phases[phase] }));
  const agents = Object.fromEntries(settings.map((setting) => [setting.phase, agentFor(setting)])) as Record<Phase, AgentProvider>;
  return { agents, settings };
};
