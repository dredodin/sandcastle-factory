import { appendFileSync } from "node:fs";
import type { Sandbox } from "@ai-hero/sandcastle";
import { itemSlug, type Item } from "../../shared/item.mjs";
import { log, timed } from "../../shared/logger.mjs";
import { mergeCommand, messagesFor } from "../../shared/merge-record.mjs";
import { logFileName, verifyCommand } from "../../shared/names.mjs";
import { inParallel } from "../../shared/parallel.mjs";
import { promptPath } from "../../shared/paths.mjs";
import { isMerged } from "../../shared/repo.mjs";
import { IDLE_TIMEOUT_SECONDS, logging, type Cycle } from "../../shared/run.mjs";
import type { Repo } from "../../shared/workspace.mjs";

// One branch to merge: the exact merge command, and what the branch brings.
type Merge = { readonly command: string; readonly branch: string; readonly brings: string };

const mergeOf = (branch: string, messages: readonly string[], brings: string): Merge => ({ command: mergeCommand(branch, messages), branch, brings });

// Runs each merge command, then verify, in the integration sandbox; output goes to `logPath`.
// Resolves to why the agent must take over, or null when all merged and verify is green.
// On failure the branch is back at the HEAD it started from: no merge stays without a green verify.
const scriptMerge = async (integration: Sandbox, merges: readonly Merge[], verify: string, logPath: string): Promise<string | null> => {
  const step = async (command: string): Promise<boolean> => {
    const { exitCode, stdout, stderr } = await integration.exec(command);
    appendFileSync(logPath, `$ ${command}\n${stdout}${stderr}\nexit ${exitCode}\n\n`);
    return exitCode === 0;
  };
  const recorded = await integration.exec("git rev-parse HEAD");
  if (recorded.exitCode !== 0) throw new Error(`Merge script could not read HEAD of ${integration.branch}: ${recorded.stderr.trim()}`);
  const head = recorded.stdout.trim();
  const attempt = async (): Promise<string | null> => {
    for (const merge of merges) {
      if (!(await step(merge.command))) return `conflict on ${merge.branch}`;
    }
    return (await step(verify)) ? null : "verify red";
  };
  const reason = await attempt();
  if (reason === null) return null;
  await step("git rev-parse -q --verify MERGE_HEAD >/dev/null && git merge --abort || true");
  if (!(await step(`git reset --hard ${head}`))) throw new Error(`Merge script could not reset ${integration.branch} to ${head}.`);
  return reason;
};

// Script first; the merge agent only on a conflict or a red verify. Throws if a branch is left out.
const runMerge = async (cycle: Cycle, repo: Repo, name: string, merges: readonly Merge[]): Promise<void> => {
  const integration = await cycle.integrations.get(repo);
  const logName = logFileName(`${cycle.number}-${name}`, repo.name, cycle.workspace.home.name);
  const reason = await timed(`${name} in ${repo.name}, cycle ${cycle.number}`, async () => {
    const handover = await scriptMerge(integration, merges, verifyCommand(repo.name), logging(cycle, `${logName}-script`).path);
    if (handover === null) return null;
    log.info(`Merge into ${repo.name} handed to the agent: ${handover}.`);
    await integration.run({
      agent: cycle.agents.MERGE,
      promptFile: promptPath("merge"),
      promptArgs: {
        MERGES: merges.map(({ command, brings }) => `- \`${command}\` — ${brings}`).join("\n"),
        VERIFY: verifyCommand(repo.name),
      },
      maxIterations: 1,
      name: "merge",
      idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS,
      logging: logging(cycle, logName),
    });
    return handover;
  });
  const branches = merges.map((merge) => merge.branch);
  const unmerged = branches.filter((branch) => !isMerged(repo, branch, integration.branch));
  if (unmerged.length > 0) throw new Error(`Merge in ${repo.name} left out ${unmerged.join(", ")}.`);
  log.info(`Merged into ${repo.name} ${integration.branch} by ${reason === null ? "script" : "agent"}: ${branches.join(", ")}`);
};

// Repos merge concurrently; items of one repo in their given order.
export const merge = async (cycle: Cycle, items: readonly Item[]): Promise<void> => {
  const own = cycle.workspace.repos
    .map((repo) => ({ repo, items: items.filter((item) => item.repo === repo.name) }))
    .filter((group) => group.items.length > 0);
  await inParallel(own, (group) => group.repo.name, (group) =>
    runMerge(cycle, group.repo, "merge", group.items.map((item) => mergeOf(item.branch, messagesFor(item), `${itemSlug(item)}: ${item.title}`))),
  );
};

// Brings each repo's default branch into its integration branch, repos concurrently; throws if one is left out.
export const mergeDefaults = async (cycle: Cycle, repos: readonly Repo[]): Promise<void> => {
  await inParallel(repos, (repo) => repo.name, (repo) =>
    runMerge(cycle, repo, "merge-default", [mergeOf(repo.base, [`SANDCASTLE: merge ${repo.base}`], "brings the branch up to date")]),
  );
};
