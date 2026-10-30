// `take <N>`: delivers issue N's tree as one PR per touched repo.
// plan → implement in parallel → merge → re-plan …, then review (two passes at most, each followed by cycles on what it filed) per repo against its default branch, then the PR phase.

import { loadAgents } from "../shared/agents.mjs";
import type { Env } from "../shared/env.mjs";
import { checkRoot, integrationBranch, isMerged } from "../shared/repo.mjs";
import type { Run } from "../shared/run.mjs";
import { withIntegrations } from "../shared/sandbox.mjs";
import type { Repo, Workspace } from "../shared/workspace.mjs";
import { cycles, finish, startRun } from "./cycle.mjs";

const FIRST_TAKE_PRS = "(none: this is a first take)";

export const take = async (workspace: Workspace, env: Env, root: number): Promise<string> => {
  const { agents, settings } = loadAgents(env);
  const title = checkRoot(workspace, root);
  const branch = integrationBranch(workspace, root);
  const logDir = startRun("take", { workspace, env, settings }, root, title, branch);

  const context = { workspace, env };
  return withIntegrations(context, (repo) => ({ repo, branch, baseBranch: repo.base }), async (integrations) => {
    const run: Run = { agents, context, workspace, root, title, branch, integrations, logDir };
    const planned = await cycles(run, FIRST_TAKE_PRS);
    const touched = (): readonly Repo[] => integrations.opened().filter((repo) => !isMerged(repo, branch, repo.base));
    if (touched().length === 0) return "Nothing completed: no PR.";
    return finish(run, FIRST_TAKE_PRS, touched, planned);
  });
};
