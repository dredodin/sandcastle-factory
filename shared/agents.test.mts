import assert from "node:assert/strict";
import { test } from "node:test";
import { loadAgents } from "./agents.mjs";
import type { Env, Phase, PhaseSetting } from "./env.mjs";

const envWith = (effort: string): Env => {
  const phase: PhaseSetting = { provider: "codex", model: "m", effort };
  const phases = Object.fromEntries(["PLAN", "IMPLEMENT", "REVIEW", "MERGE", "PR"].map((name) => [name, phase])) as Record<Phase, PhaseSetting>;
  return { sandbox: "none", phases, secrets: {}, mountCodexLogin: false, repoPaths: {} };
};

test("loadAgents: a codex effort is low | medium | high | xhigh", () => {
  assert.doesNotThrow(() => loadAgents(envWith("xhigh")));
  assert.throws(() => loadAgents(envWith("max")), /PLAN_EFFORT/);
});
