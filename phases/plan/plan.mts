import { z } from "zod";
import { extract } from "../../shared/extract.mjs";
import { itemFits, itemSchema, itemSlug } from "../../shared/item.mjs";
import { log } from "../../shared/logger.mjs";
import { promptPath } from "../../shared/paths.mjs";
import { isMerged, itemBranch, mergedIssues } from "../../shared/repo.mjs";
import { DISCLAIMER, IDLE_TIMEOUT_SECONDS, logging, type Cycle, type Plan } from "../../shared/run.mjs";
import { reposText, stateText } from "../../shared/text.mjs";
import { repoNamed } from "../../shared/workspace.mjs";

// What to do now: the repos whose default branch to merge first, and the items unblocked and not yet merged on the branches.
// The plan agent runs in the home repo's integration worktree; `openPrsText` lists the run's open PRs to read comments from (resume only).
export const plan = async (cycle: Cycle, openPrsText: string): Promise<Plan> => {
  const { workspace, branch } = cycle;
  const { home, repos } = workspace;
  const opened = new Set(cycle.integrations.opened().map((repo) => repo.name));
  const integration = await cycle.integrations.get(home);
  const state = stateText(
    branch,
    repos.map((repo) => ({
      repo: repo.name,
      opened: opened.has(repo.name),
      merged: opened.has(repo.name) ? mergedIssues(repo, branch) : [],
      baseMerged: opened.has(repo.name) && isMerged(repo, repo.base, branch),
      base: repo.base,
    })),
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
    },
    maxIterations: 1,
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
