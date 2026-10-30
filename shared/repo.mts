import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { assertNoOpenTake, freeItemBranch, nextTakeBranch, pickLatestTake, type LatestTake, type RepoPrs, type RunKey } from "./branches.mjs";
import { issuesIn } from "./merge-record.mjs";
import { githubUrl } from "./names.mjs";
import { sh, succeeds } from "./shell.mjs";
import type { Repo, Workspace } from "./workspace.mjs";

export const repoUrl = (repo: Repo): string => githubUrl(repo.slug);

const rootSchema = z.object({
  title: z.string(),
  state: z.string(),
  labels: z.array(z.object({ name: z.string() })),
});

// Returns the root issue's title. Issues live in the home repo only.
export const checkRoot = (workspace: Workspace, root: number): string => {
  const { home } = workspace;
  const issue = rootSchema.parse(JSON.parse(sh(home.path, "gh", "issue", "view", `${root}`, "--repo", home.slug, "--json", "title,state,labels")));
  if (issue.state !== "OPEN") throw new Error(`#${root} is ${issue.state.toLowerCase()}.`);
  if (!issue.labels.some((label) => label.name === "ready-for-agent")) {
    throw new Error(`#${root} carries no \`ready-for-agent\` label.`);
  }
  return issue.title;
};

// Branch names of local and origin refs, without the `origin/` prefix.
const refNames = (repo: Repo): ReadonlySet<string> =>
  new Set(
    sh(repo.path, "git", "for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes/origin")
      .split("\n")
      .map((ref) => ref.replace(/^origin\//, "")),
  );

const prSchema = z.array(z.object({ url: z.string(), headRefName: z.string() }));

const listOpenPrs = (repo: Repo): RepoPrs => ({
  repo: repo.name,
  prs: prSchema.parse(JSON.parse(sh(repo.path, "gh", "pr", "list", "--repo", repo.slug, "--state", "open", "--limit", "200", "--json", "url,headRefName"))),
});

const fetchOrigin = (repo: Repo): void => {
  sh(repo.path, "git", "fetch", "origin");
};

const runKey = (workspace: Workspace, root: number): RunKey => ({ home: workspace.home.name, root });

// The next take's branch name, K counted in the home repo. Every repo is fetched: worktrees are cut from its fresh default branch.
export const integrationBranch = (workspace: Workspace, root: number): string => {
  assertNoOpenTake(runKey(workspace, root), workspace.repos.map(listOpenPrs));
  workspace.repos.forEach(fetchOrigin);
  return nextTakeBranch(runKey(workspace, root), refNames(workspace.home));
};

const MERGE_TREE_CONFLICT = 1;

// Fetches the repo, then whether its branch, if it exists, would conflict merging the default branch (`git merge-tree` exits 1; any other failure throws).
export const conflictsWithBase = (repo: Repo, branch: string): boolean => {
  fetchOrigin(repo);
  if (!branchExists(repo, branch)) return false;
  try {
    sh(repo.path, "git", "merge-tree", "--write-tree", branch, repo.base);
    return false;
  } catch (error) {
    if ((error as { status?: number }).status === MERGE_TREE_CONFLICT) return true;
    throw error;
  }
};

export const isMerged = (repo: Repo, branch: string, into: string): boolean =>
  succeeds(repo.path, "git", "merge-base", "--is-ancestor", branch, into);

// Full messages of the merge commits the branch carries past the default branch, first-merged first.
export const mergeMessages = (repo: Repo, branch: string): readonly string[] =>
  sh(repo.path, "git", "log", "--merges", "--reverse", "--format=%B%x00", `${repo.base}..${branch}`).split("\0");

export const branchExists = (repo: Repo, branch: string): boolean =>
  succeeds(repo.path, "git", "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`);

// The latest take of the root by its branch, among local and origin refs of every repo. Every repo is fetched first.
export const latestTake = (workspace: Workspace, root: number): LatestTake => {
  workspace.repos.forEach(fetchOrigin);
  return pickLatestTake(runKey(workspace, root), workspace.repos.map((repo) => ({ repo: repo.name, refs: refNames(repo) })));
};

// Fails when the branch is checked out in the repo's main working tree: a worktree of it could not be made.
export const checkNotCheckedOut = (repo: Repo, branch: string): void => {
  if (sh(repo.path, "git", "branch", "--show-current") === branch) throw new Error(`\`${branch}\` is checked out in \`${repo.path}\`: run \`git switch ${repo.defaultBranch}\` there.`);
};

// Lines for the plan prompt: the open PRs of the branch, in the repos that have one.
export const openPrsText = (workspace: Workspace, branch: string): string => {
  const lines = workspace.repos.flatMap((repo) =>
    listOpenPrs(repo).prs.filter((pr) => pr.headRefName === branch).map((pr) => `- \`${repo.name}\`: ${pr.url}`),
  );
  return lines.length > 0 ? lines.join("\n") : "(none: the take has no open PR yet)";
};

// Path of the worktree that has the branch checked out, if any.
export const worktreeOf = (repo: Repo, branch: string): string | undefined =>
  sh(repo.path, "git", "worktree", "list", "--porcelain")
    .split("\n\n")
    .map((block) => block.split("\n"))
    .find((lines) => lines.includes(`branch refs/heads/${branch}`))?.[0]
    ?.replace(/^worktree /, "");

// Merges `origin/<branch>` into the local branch in a worktree on it; a conflict is aborted and thrown.
const mergeOrigin = (cwd: string, repo: Repo, branch: string): void => {
  try {
    sh(cwd, "git", "merge", "--no-edit", `origin/${branch}`);
  } catch {
    sh(cwd, "git", "merge", "--abort");
    throw new Error(`Merge conflict syncing ${branch} with origin/${branch} in ${repo.name}: resolve it by hand.`);
  }
};

// Syncs the local branch with origin's before a resume: missing local created, behind brought up, diverged merged.
// A missing origin branch is left to the PR phase's push. A kept worktree on the branch with uncommitted changes stops the run.
export const syncWithOrigin = (repo: Repo, branch: string): void => {
  const remote = `origin/${branch}`;
  const kept = worktreeOf(repo, branch);
  if (kept !== undefined && sh(kept, "git", "status", "--porcelain") !== "") throw new Error(`Uncommitted changes on ${branch} in ${repo.name}: ${kept}`);
  const hasRemote = succeeds(repo.path, "git", "rev-parse", "--verify", "--quiet", `refs/remotes/${remote}`);
  if (!hasRemote) return;
  if (!branchExists(repo, branch)) {
    sh(repo.path, "git", "branch", branch, remote);
    return;
  }
  if (isMerged(repo, remote, branch)) return;
  if (kept !== undefined) {
    mergeOrigin(kept, repo, branch);
    return;
  }
  const temp = join(mkdtempSync(join(tmpdir(), "sandcastle-sync-")), "worktree");
  sh(repo.path, "git", "worktree", "add", temp, branch);
  try {
    mergeOrigin(temp, repo, branch);
  } finally {
    sh(repo.path, "git", "worktree", "remove", "--force", temp);
  }
};

export const itemBranch = (repo: Repo, integration: string, slug: string): string => freeItemBranch(integration, slug, refNames(repo));

// Issues whose merge commit the branch carries past the repo's default branch, in first-merged order.
export const mergedIssues = (repo: Repo, branch: string): readonly number[] => issuesIn(mergeMessages(repo, branch));
