import type { PhaseSettings } from "../shared/agents.mjs";
import type { Mode } from "../shared/branches.mjs";
import { configBlock } from "../shared/config-block.mjs";
import type { Env } from "../shared/env.mjs";
import { review } from "../phases/review/review.mjs";
import { implement } from "../phases/implement/implement.mjs";
import { merge, mergeDefaults } from "../phases/merge/merge.mjs";
import { freshPlan, plan, type PlanSession } from "../phases/plan/plan.mjs";
import { pr } from "../phases/pr/pr.mjs";
import type { Item } from "../shared/item.mjs";
import { log, openRunLog } from "../shared/logger.mjs";
import { inParallel } from "../shared/parallel.mjs";
import { conflictsWithBase } from "../shared/repo.mjs";
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

// One cycle: plan, merge default branches (conflicting ones always, plus the plan's), implement each item in parallel in its repo, merge.
// Resolves to the planned items, none when the plan is empty, and the next cycle's plan session.
const cycle = async (
  run: Run,
  number: number,
  openPrsText: string,
  session: PlanSession,
): Promise<{ readonly items: readonly Item[]; readonly next: PlanSession }> => {
  log.info(`\n=== Cycle ${number}/${MAX_CYCLES} ===`);
  const current = { ...run, number };

  const conflicting = run.workspace.repos.filter((repo) => conflictsWithBase(repo, run.branch));
  conflicting.forEach((repo) => log.info(`  ${run.branch} conflicts with ${repo.base} in ${repo.name}`));
  const { defaults: asked, items, next } = await plan(current, openPrsText, session);
  const defaults = [...new Set([...conflicting, ...asked])];
  if (defaults.length === 0 && items.length === 0) {
    log.info("Nothing to do: plan is empty.");
    return { items: [], next };
  }
  await mergeDefaults(current, defaults);
  await Promise.all([...new Set(items.map((item) => item.repo))].map((name) => current.integrations.get(repoNamed(run.workspace, name))));

  // Each item in its own worktree of its repo, done by its one agent.
  // Resolves to whether the item's branch carries commits to merge.
  const committed = await inParallel(items, (item) => item.issue, (item) =>
    withSandbox(run.context, { repo: repoNamed(run.workspace, item.repo), name: item.issue, branch: item.branch, baseBranch: run.branch }, (sandbox) =>
      implement(current, sandbox, item),
    ),
  );
  const done = items.filter((_, index) => committed[index]);
  if (done.length === 0) log.info("No item produced commits. Nothing to merge.");
  else await merge(current, done);
  return { items, next };
};

// Cycles until the plan is empty or the cap is reached; one after another, each plans on the last one's merge.
// The first plans in a fresh session, each later one continues the last plan's when the provider can.
// Resolves to every item planned along the way.
export const cycles = (run: Run, openPrsText: string): Promise<readonly Item[]> => {
  const from = async (number: number, session: PlanSession): Promise<readonly Item[]> => {
    const { items, next } = await cycle(run, number, openPrsText, session);
    if (items.length === 0) return [];
    if (number === MAX_CYCLES) {
      log.info(`Cycle cap (${MAX_CYCLES}) reached.`);
      return items;
    }
    return [...items, ...(await from(number + 1, next))];
  };
  return from(1, freshPlan(run));
};

const REVIEW_PASSES = 2;

// Up to two review passes per touched repo over its whole branch, cycles on what each filed (none filed: stop), then the one PR phase.
// `touched` is read anew after each cycles stretch.
export const finish = async (run: Run, openPrsText: string, touched: () => readonly Repo[], planned: readonly Item[]): Promise<string> => {
  let items = planned;
  for (let pass = 1; pass <= REVIEW_PASSES; pass++) {
    await inParallel(touched(), (repo) => repo.name, (repo) => review(run, repo, pass));
    const filed = await cycles(run, openPrsText);
    items = [...items, ...filed];
    if (filed.length === 0) break;
  }
  return `PR:\n${await pr(run, touched(), items)}`;
};
