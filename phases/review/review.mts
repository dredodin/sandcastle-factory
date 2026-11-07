import { log, timedPhase } from "../../shared/logger.mjs";
import { deepVerifyCommand } from "../../shared/names.mjs";
import { promptPath } from "../../shared/paths.mjs";
import { rejectedText } from "../../shared/record.mjs";
import { reviewReport } from "../../shared/review-report.mjs";
import { IDLE_TIMEOUT_SECONDS, phaseAgent, type Run } from "../../shared/run.mjs";
import { otherBranchesText } from "../../shared/text.mjs";
import type { Repo } from "../../shared/workspace.mjs";

// Runs the one review agent, once over the whole integration branch of one repo against its default branch. Resolves to its Review report ("" when nothing found).
export const review = async (run: Run, repo: Repo): Promise<string> => {
  const { home } = run.workspace;
  const integration = await run.integrations.get(repo);
  const result = await timedPhase(`review ${repo.name}`, `review ${repo.name}`, () => integration.run({
    promptFile: promptPath("review"),
    promptArgs: {
      ROOT: run.root,
      HOME_SLUG: home.slug,
      REPO_NAME: repo.name,
      REPO_SLUG: repo.slug,
      INTEGRATION_BRANCH: run.branch,
      BASE_BRANCH: repo.base,
      DEEP_VERIFY: deepVerifyCommand(repo.name, repo.base),
      OTHER_BRANCHES: otherBranchesText(run.integrations.opened(), repo.name, run.branch),
      REJECTED: rejectedText(run.record.rejected()),
    },
    name: "review",
    idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS,
    ...phaseAgent(run, "REVIEW", "review", repo.name),
  }));
  const { report, warning } = reviewReport(result.stdout);
  if (warning !== "") log.warn(`  review ${repo.name}: ${warning}`);
  log.info(`  review ${repo.name} report:\n${report === "" ? "(nothing found)" : report}`);
  return report;
};
