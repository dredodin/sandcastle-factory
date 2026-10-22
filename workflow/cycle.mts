import type { PhaseSettings } from "../shared/agents.mjs";
import type { Mode, OpenTake } from "../shared/branches.mjs";
import { configBlock } from "../shared/config-block.mjs";
import type { Env } from "../shared/env.mjs";
import { review } from "../phases/review/review.mjs";
import { implement } from "../phases/implement/implement.mjs";
import { merge, mergeDefaults } from "../phases/merge/merge.mjs";
import { plan } from "../phases/plan/plan.mjs";
import { pr } from "../phases/pr/pr.mjs";
import { itemSlug, type Item } from "../shared/item.mjs";
import { log, openRunLog } from "../shared/logger.mjs";
import { inParallel } from "../shared/parallel.mjs";
import type { Run } from "../shared/run.mjs";
import { withSandbox } from "../shared/sandbox.mjs";
import { repoNamed, type Repo, type Workspace } from "../shared/workspace.mjs";

const MAX_CYCLES = 10;

// Opens the run's log folder and logs what the run is; returns the folder.
export const startRun = (
  mode: Mode,
  run: { readonly workspace: Workspace; readonly env: Env; readonly settings: readonly PhaseSettings[] },
  root: number,
  title: string,
  branch: string,
): string => {
  const { workspace, env, settings } = run;
  const logDir = openRunLog(workspace.root, mode, { home: workspace.home.name, root }, branch);
  log.info(configBlock({ mode, root, title, branch, logDir, repos: workspace.repos.map((repo) => repo.slug), sandbox: env.sandbox, settings, maxCycles: MAX_CYCLES }));
  return logDir;
};

// One cycle: plan, merge default branches if asked, implement each item in parallel in its repo, merge.
// Resolves to the planned items, none when the plan is empty.
const cycle = async (run: Run, number: number, openPrsText: string): Promise<readonly Item[]> => {
  log.info(`\n=== Cycle ${number}/${MAX_CYCLES} ===`);
  const current = { ...run, number };

  const { defaults, items } = await plan(current, openPrsText);
  if (defaults.length === 0 && items.length === 0) {
    log.info("Nothing to do: plan is empty.");
    return [];
  }
  await mergeDefaults(current, defaults);
  await Promise.all([...new Set(items.map((item) => item.repo))].map((name) => current.integrations.get(repoNamed(run.workspace, name))));

  // Each item in its own worktree of its repo, done by its one agent.
  // Resolves to whether the item's branch carries commits to merge.
  const committed = await inParallel(items, itemSlug, (item) =>
    withSandbox(run.context, { repo: repoNamed(run.workspace, item.repo), branch: item.branch, baseBranch: run.branch }, itemSlug(item), (sandbox) =>
      implement(current, sandbox, item),
    ),
  );
  const done = items.filter((_, index) => committed[index]);
  if (done.length === 0) log.info("No item produced commits. Nothing to merge.");
  else await merge(current, done);
  return items;
};

// Cycles until the plan is empty or the cap is reached; one after another, each plans on the last one's merge.
// Resolves to every item planned along the way.
export const cycles = (run: Run, openPrsText: string): Promise<readonly Item[]> => {
  const from = async (number: number): Promise<readonly Item[]> => {
    const items = await cycle(run, number, openPrsText);
    if (items.length === 0) return [];
    if (number === MAX_CYCLES) {
      log.info(`Cycle cap (${MAX_CYCLES}) reached.`);
      return items;
    }
    return [...items, ...(await from(number + 1))];
  };
  return from(1);
};

// One review per touched repo over its whole branch, then the PRs. `kept` are open PRs of repos the run left as they were.
export const finish = async (run: Run, touched: readonly Repo[], kept: readonly OpenTake[], planned: readonly Item[]): Promise<string> => {
  await inParallel(touched, (repo) => repo.name, (repo) => review(run, repo));
  return `PR:\n${await pr(run, touched, kept, planned)}`;
};
