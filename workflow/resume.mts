// `resume <N>`: continues the latest take of issue N from whatever state it stopped in, found by its branch.
// Syncs the branches with origin, same cycle as `take`, then review and the PR phase for every repo whose take branch is ahead of its default branch.

import { loadAgents } from "../shared/agents.mjs";
import type { Env } from "../shared/env.mjs";
import { branchExists, checkNotCheckedOut, checkRoot, hasFileDiff, latestTake, openPrsText, syncWithOrigin } from "../shared/repo.mjs";
import type { Run } from "../shared/run.mjs";
import { withIntegrations, type SandboxSpec } from "../shared/sandbox.mjs";
import { repoNamed, type Repo, type Workspace } from "../shared/workspace.mjs";
import { cycles, finish, startRun } from "./cycle.mjs";

export const resume = async (workspace: Workspace, env: Env, root: number): Promise<string> => {
  const { agents, settings } = loadAgents(env);
  const title = checkRoot(workspace, root);
  const { branch, repos } = latestTake(workspace, root);
  repos.forEach((name) => checkNotCheckedOut(repoNamed(workspace, name), branch));
  repos.forEach((name) => syncWithOrigin(repoNamed(workspace, name), branch));
  const logDir = startRun("resume", { workspace, env, settings }, root, title, branch);

  const context = { workspace, env };
  // A repo new to the take starts from its default branch.
  const specFor = (repo: Repo): Omit<SandboxSpec, "name"> => ({ repo, branch, baseBranch: branchExists(repo, branch) ? branch : repo.base });
  return withIntegrations(context, specFor, async (integrations) => {
    const run: Run = { agents, context, workspace, root, title, branch, integrations, logDir };
    const prsText = openPrsText(workspace, branch);
    const planned = await cycles(run, prsText);
    const touched = (): readonly Repo[] => workspace.repos.filter((repo) => branchExists(repo, branch) && hasFileDiff(repo, branch, repo.base));
    if (touched().length === 0) return "Nothing to resume";
    return finish(run, prsText, touched, planned);
  });
};
