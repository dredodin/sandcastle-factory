import type { PhaseSettings } from "../shared/agents.mjs";
import type { Mode } from "../shared/branches.mjs";
import { configBlock } from "../shared/config-block.mjs";
import type { Env } from "../shared/env.mjs";
import { review } from "../phases/review/review.mjs";
import { implement } from "../phases/implement/implement.mjs";
import { merge, mergeDefaults } from "../phases/merge/merge.mjs";
import { freshPlan, plan, type PlanSession } from "../phases/plan/plan.mjs";
import { pr } from "../phases/pr/pr.mjs";
import { postReplies } from "../phases/pr/replies.mjs";
import { hasIssue, itemId, type Item } from "../shared/item.mjs";
import { log, openRunLog, runLogs, type RunLogs } from "../shared/logger.mjs";
import { inParallel } from "../shared/parallel.mjs";
import { mergeCommitOf } from "../shared/merge-record.mjs";
import { cycleEnds } from "../shared/record.mjs";
import { conflictsWithBase, mergeSubjects } from "../shared/repo.mjs";
import type { Run } from "../shared/run.mjs";
import { withSandbox } from "../shared/sandbox.mjs";
import { repoNamed, type Repo, type Workspace } from "../shared/workspace.mjs";

const MAX_CYCLES = 10;

// Opens the run's log folder and logs what the run is; returns its log files.
export const startRun = (
  mode: Mode,
  run: { readonly workspace: Workspace; readonly env: Env; readonly settings: readonly PhaseSettings[] },
  root: number,
  title: string,
  branch: string,
): RunLogs => {
  const { workspace, env, settings } = run;
  const logDir = openRunLog(workspace.root, mode, { home: workspace.home.name, root }, branch);
  log.info(configBlock({ mode, root, title, branch, logDir, repos: workspace.repos.map((repo) => repo.slug), sandbox: env.sandbox, settings, maxCycles: MAX_CYCLES }));
  return runLogs(logDir);
};

// One cycle: plan, merge default branches (the conflicting ones), implement each item in parallel in its repo, merge.
// Resolves to the planned items, none when the plan is empty, whether the root as item was worked (the cycles stop), and the next cycle's plan session.
const cycle = async (
  run: Run,
  number: number,
  openPrsText: string,
  stretch: string,
  session: PlanSession,
): Promise<{ readonly items: readonly Item[]; readonly next: PlanSession; readonly stop: boolean }> => {
  log.info(`\n=== ${stretch}: cycle ${number}/${MAX_CYCLES} ===`);
  const current = { ...run, number };

  const conflicting = run.workspace.repos.filter((repo) => conflictsWithBase(repo, run.branch));
  conflicting.forEach((repo) => log.info(`  ${run.branch} conflicts with ${repo.base} in ${repo.name}`));
  const { items, next } = await plan(current, openPrsText, session);
  // The reports reach the plan agent once, in the cycle after their pass.
  run.record.clearReports();
  if (conflicting.length === 0 && items.length === 0) {
    log.info("Nothing to do: plan is empty.");
    return { items: [], next, stop: false };
  }
  await mergeDefaults(current, conflicting);
  await Promise.all([...new Set(items.map((item) => item.repo))].map((name) => current.integrations.get(repoNamed(run.workspace, name))));

  // Each item in its own worktree of its repo, done by its one agent. Resolves to what each reported.
  const outcomes = await inParallel(items, itemId, (item) =>
    withSandbox(run.context, { repo: repoNamed(run.workspace, item.repo), name: itemId(item), branch: item.branch, baseBranch: run.branch }, (sandbox) =>
      implement(current, sandbox, item),
    ),
  );
  // Without code: the sub-issue is closed or sent to Backlog now; an item without an issue only logs it. Committed: merged first.
  const ended = items.flatMap((item, index) => {
    const { outcome, note } = outcomes[index]!;
    return outcome === "committed" ? [] : [{ item, outcome, note: note === "" ? `Implement reported: ${outcome}.` : note }];
  });
  for (const { item, outcome, note } of ended) {
    if (hasIssue(item)) await run.kanban.move(Number(item.issue), outcome, note);
    else log.info(`  ${itemId(item)}: ${outcome}: ${note}`);
  }
  const done = items.filter((_, index) => outcomes[index]!.outcome === "committed");
  // A committed note is the reconciled report of the agent: keep it visible.
  items.forEach((item, index) => {
    const { outcome, note } = outcomes[index]!;
    if (outcome === "committed" && note !== "") log.info(`  ${itemId(item)}: ${note}`);
  });
  const leftOut = done.length === 0 ? [] : await merge(current, done);
  if (done.length === 0) log.info("No item committed. Nothing to merge.");
  const ends = cycleEnds(items.map((item, index) => ({ item, outcome: outcomes[index]!.outcome })), leftOut);
  const subjects = new Map([...new Set(ends.merged.map((item) => item.repo))].map((name) => [name, mergeSubjects(repoNamed(run.workspace, name), run.branch)]));
  run.record.addMerged(ends.merged.map((item) => {
    const commit = mergeCommitOf(subjects.get(item.repo) ?? [], item, run.root);
    if (commit === "") log.warn(`  ${itemId(item)}: no merge commit found on \`${run.branch}\`; its comments get no reply.`);
    return { item, commit };
  }));
  run.record.addEnded(ends.ended);
  for (const item of done) {
    if (!hasIssue(item)) {
      if (leftOut.includes(item)) log.warn(`  ${itemId(item)}: the merge of \`${item.branch}\` left it out.`);
      continue;
    }
    if (leftOut.includes(item)) await run.kanban.move(Number(item.issue), "merge conflict", `The merge of \`${item.branch}\` into \`${run.branch}\` left it out: resolve the conflict, then move this issue to Ready for agent.`);
    else await run.kanban.move(Number(item.issue), "merged", `Done: merged into \`${run.branch}\`.`);
  }
  // The root as item is worked once, merged, left out or ended without code: planning it again would repeat the same end.
  return { items, next, stop: items.some((item) => hasIssue(item) && Number(item.issue) === run.root) };
};

// Cycles until the plan is empty or the cap is reached; one after another, each plans on the last one's merge.
// The first plans in a fresh session, each later one continues the last plan's when the provider can.
// Resolves to every item planned along the way.
export const cycles = (run: Run, openPrsText: string, stretch: string): Promise<readonly Item[]> => {
  const from = async (number: number, session: PlanSession): Promise<readonly Item[]> => {
    const { items, next, stop } = await cycle(run, number, openPrsText, stretch, session);
    if (items.length === 0) return [];
    if (stop) return items;
    if (number === MAX_CYCLES) {
      log.info(`Cycle cap (${MAX_CYCLES}) reached.`);
      return items;
    }
    return [...items, ...(await from(number + 1, next))];
  };
  return from(1, freshPlan(run));
};

const REVIEW_PASSES = 2;

// Up to two review passes per touched repo over its whole branch, cycles on what the plan makes of each pass's reports (none planned: stop), then the one PR phase.
// `touched` is read anew after each cycles stretch.
export const finish = async (run: Run, openPrsText: string, touched: () => readonly Repo[], planned: readonly Item[]): Promise<string> => {
  let items = planned;
  for (let pass = 1; pass <= REVIEW_PASSES; pass++) {
    const repos = touched();
    const passed = await inParallel(repos, (repo) => repo.name, async (repo) => [repo.name, await review(run, repo)] as const);
    run.record.addPass(new Map(passed));
    const found = await cycles(run, openPrsText, `Review ${pass}`);
    items = [...items, ...found];
    // Nothing planned ends the reviews unless a report had findings the plan rejected: pass 2 checks the rest.
    if (found.length === 0 && passed.map(([, report]) => report).every((report) => report === "")) break;
  }
  const text = await pr(run, touched(), items);
  postReplies(run);
  return `PR:\n${text}`;
};
