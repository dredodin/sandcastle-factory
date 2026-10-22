// `resume <N>`: finishes issue N's work on the branch of its open take PRs, one per repo.
// Same cycle as `take`, then one review per changed repo against its default branch, then the PR phase.

import { loadAgents } from "../shared/agents.mjs";
import type { Env } from "../shared/env.mjs";
import { checkRoot, headOf, isMerged, openTakes, syncWithOrigin } from "../shared/repo.mjs";
import type { Run } from "../shared/run.mjs";
import { withIntegrations, type SandboxSpec } from "../shared/sandbox.mjs";
import { repoNamed, type Repo, type Workspace } from "../shared/workspace.mjs";
import { cycles, finish, startRun } from "./cycle.mjs";

export const resume = async (workspace: Workspace, env: Env, root: number): Promise<string> => {
  const { agents, settings } = loadAgents(env);
  const title = checkRoot(workspace, root);
  const { branch, takes } = openTakes(workspace, root);
  takes.forEach((take) => syncWithOrigin(repoNamed(workspace, take.repo), branch));
  const logDir = startRun("resume", { workspace, env, settings }, root, title, branch);
  // From origin, so local commits a failed push left behind still count as new.
  const before = new Map(takes.map((take) => [take.repo, headOf(repoNamed(workspace, take.repo), `origin/${branch}`)]));

  const context = { workspace, env };
  const specFor = (repo: Repo): Omit<SandboxSpec, "name"> => ({ repo, branch, baseBranch: before.has(repo.name) ? `origin/${branch}` : repo.base });
  return withIntegrations(context, specFor, async (integrations) => {
    const run: Run = { agents, context, workspace, root, title, branch, integrations, logDir };
    const planned = await cycles(run, takes.map((take) => `- \`${take.repo}\`: ${take.url}`).join("\n"));
    const touched = integrations.opened().filter((repo) => {
      const previous = before.get(repo.name);
      return previous === undefined ? !isMerged(repo, branch, repo.base) : headOf(repo, `refs/heads/${branch}`) !== previous;
    });
    if (touched.length === 0) return "Nothing to resume";
    return finish(run, touched, takes, planned);
  });
};
