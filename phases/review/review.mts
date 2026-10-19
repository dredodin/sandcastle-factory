import { logFileName, verifyCommand } from "../../shared/names.mjs";
import { promptPath } from "../../shared/paths.mjs";
import { logging, type Run } from "../../shared/run.mjs";
import { otherBranchesText } from "../../shared/text.mjs";
import type { Repo } from "../../shared/workspace.mjs";

// Runs the one review agent once over the whole integration branch of one repo against its default branch.
export const review = async (run: Run, repo: Repo): Promise<void> => {
  const { home } = run.workspace;
  const integration = await run.integrations.get(repo);
  await integration.run({
    agent: run.agents.REVIEW,
    promptFile: promptPath("review"),
    promptArgs: {
      ROOT: run.root,
      HOME_SLUG: home.slug,
      REPO_NAME: repo.name,
      REPO_SLUG: repo.slug,
      INTEGRATION_BRANCH: run.branch,
      BASE_BRANCH: repo.base,
      VERIFY: verifyCommand(repo.name),
      OTHER_BRANCHES: otherBranchesText(run.integrations.opened(), repo.name, run.branch),
    },
    name: "review",
    logging: logging(run, logFileName("review", repo.name, home.name)),
  });
};
