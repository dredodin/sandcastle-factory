import { writeFileSync } from "node:fs";
import { itemSlug, type Item } from "../../shared/item.mjs";
import { log, timed } from "../../shared/logger.mjs";
import { mergeCommand, messagesFor } from "../../shared/merge-record.mjs";
import { logFileName, verifyCommand } from "../../shared/names.mjs";
import { inParallel } from "../../shared/parallel.mjs";
import { promptPath } from "../../shared/paths.mjs";
import { isMerged } from "../../shared/repo.mjs";
import { IDLE_TIMEOUT_SECONDS, phaseAgent, type Cycle } from "../../shared/run.mjs";
import type { Repo } from "../../shared/workspace.mjs";

// One branch to merge: the exact merge command, and what the branch brings.
type Merge = { readonly branch: string; readonly command: string; readonly brings: string };

// Script first: one chain merges every branch in order, then verifies; on any failure it puts HEAD back and exits non-zero,
// and the merge agent takes over with the merge prompt. Throws if a branch is left out either way.
const runMerge = async (cycle: Cycle, repo: Repo, name: string, merges: readonly Merge[]): Promise<void> => {
  const integration = await cycle.integrations.get(repo);
  const byScript = await timed(`${name} ${repo.name}`, async () => {
    const logName = logFileName(`${cycle.number}-${name}`, repo.name, cycle.workspace.home.name);
    const steps = [...merges.map((merge) => merge.command), verifyCommand(repo.name)].join(" && ");
    const chain = await integration.exec(
      `exec 2>&1; head=$(git rev-parse HEAD) || exit 1; { ${steps}; } || { git merge --abort 2>/dev/null; git reset --hard "$head"; exit 1; }`,
    );
    writeFileSync(`${cycle.logDir}/${logName}-script.log`, `${chain.stdout}\nexit ${chain.exitCode}\n`);
    if (chain.exitCode !== 0) {
      await integration.run({
        promptFile: promptPath("merge"),
        promptArgs: {
          MERGES: merges.map(({ command, brings }) => `- \`${command}\` — ${brings}`).join("\n"),
          VERIFY: verifyCommand(repo.name),
        },
        maxIterations: 1,
        name: "merge",
        idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS,
        ...phaseAgent(cycle, "MERGE", logName),
      });
    }
    return chain.exitCode === 0;
  });
  const branches = merges.map((merge) => merge.branch);
  const unmerged = branches.filter((branch) => !isMerged(repo, branch, integration.branch));
  if (unmerged.length > 0) throw new Error(`Merge in ${repo.name} left out ${unmerged.join(", ")}.`);
  log.info(`Merged into ${repo.name} ${integration.branch} by ${byScript ? "script" : "agent"}: ${branches.join(", ")}`);
};

// Repos merge concurrently; items of one repo in their given order.
export const merge = async (cycle: Cycle, items: readonly Item[]): Promise<void> => {
  const repos = cycle.workspace.repos.filter((repo) => items.some((item) => item.repo === repo.name));
  await inParallel(repos, (repo) => repo.name, (repo) =>
    runMerge(
      cycle,
      repo,
      "merge",
      items
        .filter((item) => item.repo === repo.name)
        .map((item) => ({ branch: item.branch, command: mergeCommand(item.branch, messagesFor(item)), brings: `${itemSlug(item)}: ${item.title}` })),
    ),
  );
};

// Brings each repo's default branch into its integration branch, repos concurrently; throws if one is left out.
export const mergeDefaults = async (cycle: Cycle, repos: readonly Repo[]): Promise<void> => {
  await inParallel(repos, (repo) => repo.name, (repo) =>
    runMerge(cycle, repo, "merge-default", [
      { branch: repo.base, command: mergeCommand(repo.base, [`SANDCASTLE: merge ${repo.base}`]), brings: "brings the branch up to date" },
    ]),
  );
};
