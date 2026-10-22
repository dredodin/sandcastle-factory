import type { AgentProvider, SandboxRunOptions } from "@ai-hero/sandcastle";
import { z } from "zod";
import { extract } from "../../shared/extract.mjs";
import { itemFits, itemSchema, itemSlug } from "../../shared/item.mjs";
import { log, timed } from "../../shared/logger.mjs";
import { planCheckCommand } from "../../shared/names.mjs";
import { planResumePath, promptPath } from "../../shared/paths.mjs";
import { branchExists, isMerged, itemBranch, mergedIssues } from "../../shared/repo.mjs";
import { DISCLAIMER, IDLE_TIMEOUT_SECONDS, logging, type Cycle, type Plan } from "../../shared/run.mjs";
import { reposText, stateText } from "../../shared/text.mjs";
import { repoNamed } from "../../shared/workspace.mjs";

// Copilot keeps no session sandcastle can resume.
const resumable = (agent: AgentProvider): boolean => agent.captureSessions && agent.sessionStorage !== undefined;

// What to do now: the repos whose default branch to merge first, and the items unblocked and not yet merged on the branches.
// The plan agent runs in the home repo's integration worktree; `openPrsText` lists the run's open PRs to read comments from (resume only).
// `session`: the last cycle's plan session; resumed with a short follow-up prompt when the provider can, else the full prompt.
export const plan = async (cycle: Cycle, openPrsText: string, session: string | null): Promise<Plan> => {
  const { workspace, branch } = cycle;
  const { home, repos } = workspace;
  const integration = await cycle.integrations.get(home);
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

  const agent = cycle.agents.PLAN;
  const resumed = session !== null && resumable(agent) ? session : null;
  const prompt: Pick<SandboxRunOptions, "promptFile" | "promptArgs" | "resumeSession"> =
    resumed === null
      ? {
          promptFile: promptPath("plan"),
          promptArgs: {
            ROOT: cycle.root,
            INTEGRATION_BRANCH: branch,
            DISCLAIMER,
            HOME_SLUG: home.slug,
            HOME_NAME: home.name,
            REPOS: reposText(home.name, repos),
            STATE: state,
            OPEN_PRS: openPrsText,
            PLAN_CHECK: planCheckCommand(home.name),
          },
        }
      : { promptFile: planResumePath(), resumeSession: resumed, promptArgs: { ROOT: cycle.root, HOME_NAME: home.name, STATE: state, PLAN_CHECK: planCheckCommand(home.name) } };
  if (resumed !== null) log.info(`  plan resumes session ${resumed}`);

  const result = await timed(`plan, cycle ${cycle.number}`, () => integration.run({
    agent,
    ...prompt,
    maxIterations: 1,
    completionSignal: "</plan>",
    name: "plan",
    idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS,
    logging: logging(cycle, `${cycle.number}-plan`),
  }));

  const planSchema = z.object({
    defaults: z.array(z.string()),
    items: z.array(
      itemSchema.omit({ branch: true }).refine((item) => itemFits(item, repos), "item outside the Workspace"),
    ),
  });
  const planned = extract(result.stdout, "plan", planSchema);
  const defaults = planned.defaults.map((name) => repoNamed(workspace, name));
  const items = planned.items.map((item) => ({ ...item, branch: itemBranch(repoNamed(workspace, item.repo), branch, itemSlug(item)) }));
  defaults.forEach((repo) => log.info(`  merge ${repo.base} in ${repo.name}`));
  items.forEach((item) => log.info(`  ${itemSlug(item)}: ${item.title} → ${item.repo}: ${item.branch}`));
  return { defaults, items, session: result.iterations.at(-1)?.sessionId ?? null };
};
