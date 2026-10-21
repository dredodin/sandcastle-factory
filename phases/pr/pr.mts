import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { extract } from "../../shared/extract.mjs";
import type { OpenTake } from "../../shared/branches.mjs";
import type { Item } from "../../shared/item.mjs";
import { log } from "../../shared/logger.mjs";
import { logFileName, verifyCommand } from "../../shared/names.mjs";
import { inParallel } from "../../shared/parallel.mjs";
import { mergedIssues } from "../../shared/repo.mjs";
import { promptPath } from "../../shared/paths.mjs";
import { closesLines, reposWithoutPr, runBlock, withRunBlock, type BlockedBy, type Pr } from "../../shared/pr-body.mjs";
import { DISCLAIMER, IDLE_TIMEOUT_SECONDS, logging, type Run } from "../../shared/run.mjs";
import { sh } from "../../shared/shell.mjs";
import { repoNamed, type Repo } from "../../shared/workspace.mjs";

const pullRequestSchema = z.object({ url: z.url() });
const blockedBySchema = z.object({ blockedBy: z.array(z.object({ number: z.number() })) });
const bodySchema = z.object({ body: z.string() });

// Sub-issues whose merge commit the repo's branch carries; the root is closed by every PR anyway.
const subIssuesOn = (run: Run, repo: Repo): readonly number[] => mergedIssues(repo, run.branch).filter((id) => id !== run.root);

// First pass for one repo: the PR agent pushes the branch and opens the PR, or rewrites the open one.
const prOfRepo = async (run: Run, repo: Repo): Promise<Pr> => {
  const { home } = run.workspace;
  const issues = subIssuesOn(run, repo);
  const integration = await run.integrations.get(repo);
  const result = await integration.run({
    agent: run.agents.PR,
    promptFile: promptPath("pr"),
    promptArgs: {
      INTEGRATION_BRANCH: run.branch,
      ROOT: run.root,
      ROOT_TITLE: run.title,
      HOME_SLUG: home.slug,
      REPO_NAME: repo.name,
      VERIFY: verifyCommand(repo.name),
      REPO_SLUG: repo.slug,
      DEFAULT_BRANCH: repo.defaultBranch,
      BASE_BRANCH: repo.base,
      CLOSES: closesLines(home.slug, [...issues, run.root]),
      DISCLAIMER,
    },
    maxIterations: 1,
    name: "pr",
    idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS,
    logging: logging(run, logFileName("pr", repo.name, home.name)),
  });
  return { repo: repo.name, url: extract(result.stdout, "pull-request", pullRequestSchema).url, issues };
};

// Native `blockedBy` of the issues, read from the home repo; an issue GitHub cannot answer for has no blockers.
const blockedByOf = (home: Repo, issues: readonly number[]): BlockedBy =>
  Object.fromEntries(
    issues.map((issue) => {
      try {
        const parsed = blockedBySchema.parse(JSON.parse(sh(home.path, "gh", "issue", "view", `${issue}`, "--repo", home.slug, "--json", "blockedBy")));
        return [issue, parsed.blockedBy.map((blocker) => blocker.number)];
      } catch {
        log.warn(`Could not read the blockers of #${issue}; merge order ignores them.`);
        return [issue, []];
      }
    }),
  );

// Opens or updates the PR of each touched repo in two passes: every PR first, then every body gets the run's PR list and merge order.
// `kept` are open PRs of repos this run did not change: they only get the new body. Returns one line per PR.
export const pr = async (run: Run, touched: readonly Repo[], kept: readonly OpenTake[], planned: readonly Item[]): Promise<string> => {
  const { home } = run.workspace;
  const created = await inParallel(touched, (repo) => repo.name, (repo) => prOfRepo(run, repo));
  const unchanged = kept
    .filter((take) => !touched.some((repo) => repo.name === take.repo))
    .map((take): Pr => ({
      repo: take.repo,
      url: take.url,
      issues: subIssuesOn(run, repoNamed(run.workspace, take.repo)),
    }));
  const prs = [...created, ...unchanged];

  const blockedBy = blockedByOf(home, [...new Set(prs.flatMap((pr) => pr.issues))]);
  const block = runBlock(home.slug, run.root, prs, reposWithoutPr(planned, prs.map((pr) => pr.repo)), blockedBy);
  const dir = mkdtempSync(join(tmpdir(), "sandcastle-pr-"));
  for (const pr of prs) {
    const repo = repoNamed(run.workspace, pr.repo);
    const { body } = bodySchema.parse(JSON.parse(sh(repo.path, "gh", "pr", "view", pr.url, "--json", "body")));
    const file = join(dir, `${pr.repo}.md`);
    writeFileSync(file, withRunBlock(body, block));
    sh(repo.path, "gh", "pr", "edit", pr.url, "--body-file", file);
  }
  return prs.map((pr) => `${pr.repo}: ${pr.url}`).join("\n");
};
