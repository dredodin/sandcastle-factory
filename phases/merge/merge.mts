import { itemSlug, type Item } from "../../shared/item.mjs";
import { log, timed } from "../../shared/logger.mjs";
import { messagesFor } from "../../shared/merge-record.mjs";
import { logFileName, verifyCommand } from "../../shared/names.mjs";
import { promptPath } from "../../shared/paths.mjs";
import { isMerged } from "../../shared/repo.mjs";
import { IDLE_TIMEOUT_SECONDS, logging, type Cycle } from "../../shared/run.mjs";
import type { Repo } from "../../shared/workspace.mjs";

// One branch to merge: the exact merge command, and what the branch brings.
type Merge = { readonly branch: string; readonly messages: readonly string[]; readonly brings: string };

const runMerge = async (cycle: Cycle, repo: Repo, name: string, merges: readonly Merge[]): Promise<void> => {
  const integration = await cycle.integrations.get(repo);
  await timed(`${name} in ${repo.name}, cycle ${cycle.number}`, () => integration.run({
    agent: cycle.agents.MERGE,
    promptFile: promptPath("merge"),
    promptArgs: {
      MERGES: merges
        .map(({ branch, messages, brings }) => `- \`git merge --no-ff ${branch} ${messages.map((m) => `-m "${m}"`).join(" ")}\` — ${brings}`)
        .join("\n"),
      VERIFY: verifyCommand(repo.name),
    },
    maxIterations: 1,
    name: "merge",
    idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS,
    logging: logging(cycle, logFileName(`${cycle.number}-${name}`, repo.name, cycle.workspace.home.name)),
  }));
  const branches = merges.map((merge) => merge.branch);
  const unmerged = branches.filter((branch) => !isMerged(repo, branch, integration.branch));
  if (unmerged.length > 0) throw new Error(`Merge in ${repo.name} left out ${unmerged.join(", ")}.`);
  log.info(`Merged into ${repo.name} ${integration.branch}: ${branches.join(", ")}`);
};

export const merge = async (cycle: Cycle, items: readonly Item[]): Promise<void> => {
  for (const repo of cycle.workspace.repos) {
    const own = items.filter((item) => item.repo === repo.name);
    if (own.length === 0) continue;
    await runMerge(
      cycle,
      repo,
      "merge",
      own.map((item) => ({ branch: item.branch, messages: messagesFor(item), brings: `${itemSlug(item)}: ${item.title}` })),
    );
  }
};

// Brings the repo's default branch into its integration branch; throws if it is left out.
export const mergeDefault = (cycle: Cycle, repo: Repo): Promise<void> =>
  runMerge(cycle, repo, "merge-default", [{ branch: repo.base, messages: [`SANDCASTLE: merge ${repo.base}`], brings: "brings the branch up to date" }]);
