import { readFileSync } from "node:fs";
import type { ResumeSandboxRunResultOptions, SandboxRunResult } from "@ai-hero/sandcastle";
import { z } from "zod";
import { extract } from "../../shared/extract.mjs";
import { itemFits, itemSchema } from "../../shared/item.mjs";
import { log, timed } from "../../shared/logger.mjs";
import { planCheckCommand } from "../../shared/names.mjs";
import { promptPath } from "../../shared/paths.mjs";
import { fillPrompt } from "../../shared/prompt.mjs";
import { branchExists, isMerged, itemBranch, mergedIssues } from "../../shared/repo.mjs";
import { DISCLAIMER, IDLE_TIMEOUT_SECONDS, phaseAgent, type Cycle, type Plan, type Run } from "../../shared/run.mjs";
import { reposText, stateText } from "../../shared/text.mjs";
import { repoNamed } from "../../shared/workspace.mjs";

// Runs the plan prompt, either in a fresh session or continuing the last plan's.
export type PlanSession = (prompt: string, options: ResumeSandboxRunResultOptions) => Promise<SandboxRunResult>;

export const freshPlan = (run: Run): PlanSession => async (prompt, options) =>
  (await run.integrations.get(run.workspace.home)).run({ ...options, agent: run.agents.PLAN, prompt, maxIterations: 1 });

// What to do now: the repos whose default branch to merge first, and the items unblocked and not yet merged on the branches.
// The plan agent runs in the home repo's integration worktree; `openPrsText` lists the run's open PRs to read comments from (resume only).
// `next` resumes this plan's session when the provider can (sandcastle's `resume`), else starts fresh.
export const plan = async (cycle: Cycle, openPrsText: string, session: PlanSession): Promise<Plan & { readonly next: PlanSession }> => {
  const { workspace, branch } = cycle;
  const { home, repos } = workspace;
  // Opened before STATE is read: a take's first cycle creates the home branch here.
  await cycle.integrations.get(home);
  // A repo's branch, not its worktree: a resume's first cycle has the branches of the open take, none opened yet.
  const state = stateText(
    branch,
    repos.map((repo) => {
      const opened = branchExists(repo, branch);
      return {
        repo: repo.name,
        opened,
        merged: opened ? mergedIssues(repo, branch) : [],
        baseMerged: opened && isMerged(repo, repo.base, branch),
        base: repo.base,
      };
    }),
  );

  const prompt = fillPrompt(readFileSync(promptPath("plan"), "utf8"), {
    ROOT: String(cycle.root),
    INTEGRATION_BRANCH: branch,
    DISCLAIMER,
    HOME_SLUG: home.slug,
    HOME_NAME: home.name,
    REPOS: reposText(home.name, repos),
    STATE: state,
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
    defaults: z.array(z.string()),
    items: z.array(
      itemSchema.omit({ branch: true }).refine((item) => itemFits(item, repos), "item outside the Workspace"),
    ),
  });
  const planned = extract(result.stdout, "plan", planSchema);
  const defaults = planned.defaults.map((name) => repoNamed(workspace, name));
  const items = planned.items.map((item) => ({ ...item, branch: itemBranch(repoNamed(workspace, item.repo), branch, item.issue) }));
  defaults.forEach((repo) => log.info(`  merge ${repo.base} in ${repo.name}`));
  items.forEach((item) => log.info(`  ${item.issue}: ${item.title} → ${item.repo}: ${item.branch}`));
  return { defaults, items, next: result.resume ?? freshPlan(cycle) };
};
