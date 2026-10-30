import { claudeCode, codex, copilot, type AgentProvider } from "@ai-hero/sandcastle";
import { EFFORTS, PHASES, type Env, type Phase, type PhaseSetting, type Provider } from "./env.mjs";

export type Agents = Readonly<Record<Phase, AgentProvider>>;
export type PhaseSettings = PhaseSetting & { readonly phase: Phase };

const effortOf = <E extends string,>({ phase, provider, effort }: PhaseSettings, levels: readonly E[]): E => {
  const level = levels.find((known) => known === effort);
  if (level === undefined) throw new Error(`${phase}_EFFORT=${effort} is not a ${provider} effort.`);
  return level;
};

const BUILDERS: Readonly<Record<Provider, (setting: PhaseSettings) => AgentProvider>> = {
  claudeCode: (setting) => claudeCode(setting.model, { effort: effortOf(setting, EFFORTS.claudeCode) }),
  copilot: (setting) => copilot(setting.model, { effort: effortOf(setting, EFFORTS.copilot) }),
  codex: (setting) => codex(setting.model, { effort: effortOf(setting, EFFORTS.codex) }),
};

const agentFor = (setting: PhaseSettings): AgentProvider => BUILDERS[setting.provider](setting);

// The built agents, and the raw settings they were built from (no secrets: only provider, model, effort).
export const loadAgents = (env: Env): { readonly agents: Agents; readonly settings: readonly PhaseSettings[] } => {
  const settings = PHASES.map((phase) => ({ phase, ...env.phases[phase] }));
  const agents = Object.fromEntries(settings.map((setting) => [setting.phase, agentFor(setting)])) as Record<Phase, AgentProvider>;
  return { agents, settings };
};
