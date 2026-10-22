import { z } from "zod";
import { extract } from "../../shared/extract.mjs";
import { itemFits, itemSchema, itemSlug } from "../../shared/item.mjs";
import { log } from "../../shared/logger.mjs";
import { planCheckCommand } from "../../shared/names.mjs";
import { promptPath } from "../../shared/paths.mjs";
import { branchExists, isMerged, itemBranch, mergedIssues } from "../../shared/repo.mjs";
import { DISCLAIMER, IDLE_TIMEOUT_SECONDS, logging, type Cycle, type Plan } from "../../shared/run.mjs";
import { reposText, stateText } from "../../shared/text.mjs";
import { repoNamed } from "../../shared/workspace.mjs";

// What to do now: the repos whose default branch to merge first, and the items unblocked and not yet merged on the branches.
// The plan agent runs in the home repo's integration worktree; `openPrsText` lists the run's open PRs to read comments from (resume only).
export const plan = async (cycle: Cycle, openPrsText: string): Promise<Plan> => {
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

  const result = await integration.run({
    agent: cycle.agents.PLAN,
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
    maxIterations: 1,
    completionSignal: "</plan>",
    name: "plan",
    idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS,
    logging: logging(cycle, `${cycle.number}-plan`),
  });

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
  return { defaults, items };
};
