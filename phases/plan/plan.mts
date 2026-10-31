import { readFileSync } from "node:fs";
import type { ResumeSandboxRunResultOptions, SandboxRunResult } from "@ai-hero/sandcastle";
import { z } from "zod";
import { extract } from "../../shared/extract.mjs";
import { isRoot, itemFits, itemSchema } from "../../shared/item.mjs";
import { log, timed } from "../../shared/logger.mjs";
import { planCheckCommand } from "../../shared/names.mjs";
import { promptPath } from "../../shared/paths.mjs";
import { fillPrompt } from "../../shared/prompt.mjs";
import { branchExists, itemBranch, mergedIssues } from "../../shared/repo.mjs";
import { DISCLAIMER, IDLE_TIMEOUT_SECONDS, phaseAgent, type Cycle, type Plan, type Run } from "../../shared/run.mjs";
import { reposText } from "../../shared/text.mjs";
import { repoNamed } from "../../shared/workspace.mjs";
import { readyCreated, startItems } from "../../shared/kanban-moves.mjs";

// Runs the plan prompt, either in a fresh session or continuing the last plan's.
export type PlanSession = (prompt: string, options: ResumeSandboxRunResultOptions) => Promise<SandboxRunResult>;

export const freshPlan = (run: Run): PlanSession => async (prompt, options) =>
  (await run.integrations.get(run.workspace.home)).run({ ...options, agent: run.agents.PLAN, prompt, maxIterations: 1 });

// What to do now: the sub-issues in Ready for agent and unblocked, moved to Agent working; the root when it has no sub-issues and is not yet merged.
// The plan agent runs in the home repo's integration worktree; `openPrsText` lists the run's open PRs to read comments from (resume only).
// `next` resumes this plan's session when the provider can (sandcastle's `resume`), else starts fresh.
export const plan = async (cycle: Cycle, openPrsText: string, session: PlanSession): Promise<Plan & { readonly next: PlanSession }> => {
  const { workspace, branch } = cycle;
  const { home, repos } = workspace;
  const { owner, number } = cycle.kanbanHandle.kanban;
  // A take's first cycle creates the home branch here, before the plan agent runs.
  await cycle.integrations.get(home);
  const prompt = fillPrompt(readFileSync(promptPath("plan"), "utf8"), {
    ROOT: String(cycle.root),
    INTEGRATION_BRANCH: branch,
    DISCLAIMER,
    HOME_SLUG: home.slug,
    HOME_NAME: home.name,
    REPOS: reposText(home.name, repos),
    KANBAN_OWNER: owner,
    KANBAN_NUMBER: String(number),
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
  await readyCreated(cycle.kanbanHandle, planned.created.map(Number));
  // The root as item has no card to move; once merged on the branch it is not worked again. A repo's branch, not its worktree: a resume has none opened yet.
  const worked = planned.items.filter((item) => {
    if (!isRoot(item, cycle.root)) return true;
    const repo = repoNamed(workspace, item.repo);
    return !(branchExists(repo, branch) && mergedIssues(repo, branch).includes(cycle.root));
  });
  const items = await startItems(
    cycle,
    worked.map((item) => ({ ...item, branch: itemBranch(repoNamed(workspace, item.repo), branch, item.issue) })),
  );
  items.forEach((item) => log.info(`  ${item.issue}: ${item.title} → ${item.repo}: ${item.branch}`));
  return { items, next: result.resume ?? freshPlan(cycle) };
};
