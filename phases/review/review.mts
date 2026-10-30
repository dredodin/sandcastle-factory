import { timed } from "../../shared/logger.mjs";
import { deepVerifyCommand, logFileName } from "../../shared/names.mjs";
import { promptPath } from "../../shared/paths.mjs";
import { IDLE_TIMEOUT_SECONDS, phaseAgent, type Run } from "../../shared/run.mjs";
import { otherBranchesText } from "../../shared/text.mjs";
import type { Repo } from "../../shared/workspace.mjs";

// Runs the one review agent, once over the whole integration branch of one repo against its default branch.
export const review = async (run: Run, repo: Repo, pass: number): Promise<void> => {
  const { home } = run.workspace;
  const integration = await run.integrations.get(repo);
  await timed(`review ${repo.name}`, () => integration.run({
    promptFile: promptPath("review"),
    promptArgs: {
      ROOT: run.root,
      HOME_SLUG: home.slug,
      HOME_NAME: home.name,
      REPO_NAME: repo.name,
      REPO_SLUG: repo.slug,
      INTEGRATION_BRANCH: run.branch,
      BASE_BRANCH: repo.base,
      DEEP_VERIFY: deepVerifyCommand(repo.name, repo.base),
      OTHER_BRANCHES: otherBranchesText(run.integrations.opened(), repo.name, run.branch),
    },
    name: "review",
    idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS,
    ...phaseAgent(run, "REVIEW", logFileName(`review-${pass}`, repo.name, home.name)),
  }));
};
