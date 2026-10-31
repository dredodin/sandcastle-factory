import { readFileSync } from "node:fs";
import type { ResumeSandboxRunResultOptions, SandboxRunResult } from "@ai-hero/sandcastle";
import { z } from "zod";
import { extract } from "../../shared/extract.mjs";
import { itemFits, itemSchema } from "../../shared/item.mjs";
import { log, timed } from "../../shared/logger.mjs";
import { planCheckCommand } from "../../shared/names.mjs";
import { promptPath } from "../../shared/paths.mjs";
import { fillPrompt } from "../../shared/prompt.mjs";
import { itemBranch } from "../../shared/repo.mjs";
import { DISCLAIMER, IDLE_TIMEOUT_SECONDS, phaseAgent, type Cycle, type Plan, type Run } from "../../shared/run.mjs";
import { reposText } from "../../shared/text.mjs";
import { repoNamed } from "../../shared/workspace.mjs";

// Runs the plan prompt, either in a fresh session or continuing the last plan's.
export type PlanSession = (prompt: string, options: ResumeSandboxRunResultOptions) => Promise<SandboxRunResult>;

export const freshPlan = (run: Run): PlanSession => async (prompt, options) =>
  (await run.integrations.get(run.workspace.home)).run({ ...options, agent: run.agents.PLAN, prompt, maxIterations: 1 });

// What to do now: the unblocked sub-issues among those the Kanban has in Ready for agent, moved to Agent working; the root when it has no sub-issues.
// The plan agent runs in the home repo's integration worktree; `openPrsText` lists the run's open PRs to read comments from (resume only).
// `next` resumes this plan's session when the provider can (sandcastle's `resume`), else starts fresh.
export const plan = async (cycle: Cycle, openPrsText: string, session: PlanSession): Promise<Plan & { readonly next: PlanSession }> => {
  const { workspace, branch } = cycle;
  const { home, repos } = workspace;
  const ready = cycle.kanban.inStatus("Ready for agent");
  // A take's first cycle creates the home branch here, before the plan agent runs.
  await cycle.integrations.get(home);
  const prompt = fillPrompt(readFileSync(promptPath("plan"), "utf8"), {
    ROOT: String(cycle.root),
    INTEGRATION_BRANCH: branch,
    DISCLAIMER,
    HOME_SLUG: home.slug,
    HOME_NAME: home.name,
    REPOS: reposText(home.name, repos),
    READY: ready.length === 0 ? "(none)" : ready.map((issue) => `#${issue}`).join(", "),
    OPEN_PRS: openPrsText,
    PLAN_CHECK: planCheckCommand(home.name),
  });
  const result = await timed(`plan ${cycle.number}`, () => session(prompt, {
    completionSignal: "</plan>",
    name: "plan",
    idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS,
    logging: phaseAgent(cycle, "PLAN", `${cycle.number}-plan`).logging,
  }));

  const planSchema = z.object({
    items: z.array(
      itemSchema.omit({ branch: true }).refine((item) => itemFits(item, repos), "item outside the Workspace"),
    ),
    created: z.array(z.string().regex(/^[1-9][0-9]*$/)).default([]),
  });
  const planned = extract(result.stdout, "plan", planSchema);
  await cycle.kanban.ready(planned.created.map(Number));
  const started = await Promise.all(planned.items.map(async (item) => ({ item, taken: await cycle.kanban.move(Number(item.issue), "planned") })));
  const items = started.filter(({ taken }) => taken).map(({ item }) => ({ ...item, branch: itemBranch(repoNamed(workspace, item.repo), branch, item.issue) }));
  items.forEach((item) => log.info(`  ${item.issue}: ${item.title} → ${item.repo}: ${item.branch}`));
  return { items, next: result.resume ?? freshPlan(cycle) };
};
