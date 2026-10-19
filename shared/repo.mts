import { z } from "zod";
import { assertNoOpenTake, freeItemBranch, nextTakeBranch, pickOpenTakes, type OpenTakes, type RepoPrs, type RunKey } from "./branches.mjs";
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

export const isMerged = (repo: Repo, branch: string, into: string): boolean =>
  succeeds(repo.path, "git", "merge-base", "--is-ancestor", branch, into);

// Full messages of the merge commits the branch carries past the default branch, first-merged first.
export const mergeMessages = (repo: Repo, branch: string): readonly string[] =>
  sh(repo.path, "git", "log", "--merges", "--reverse", "--format=%B%x00", `${repo.base}..${branch}`).split("\0");

export const branchExists = (repo: Repo, branch: string): boolean =>
  succeeds(repo.path, "git", "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`);

export const headOf = (repo: Repo, ref: string): string => sh(repo.path, "git", "rev-parse", ref);

export const openTakes = (workspace: Workspace, root: number): OpenTakes => pickOpenTakes(runKey(workspace, root), workspace.repos.map(listOpenPrs));

const checkedOut = (repo: Repo, branch: string): boolean =>
  sh(repo.path, "git", "worktree", "list", "--porcelain").split("\n").includes(`branch refs/heads/${branch}`);

// Makes the local branch equal to origin's, so a worktree on it starts from the PR as it stands.
// A worktree already on the branch is left to sandcastle: it fast-forwards its own, refuses any other.
export const syncWithOrigin = (repo: Repo, branch: string): void => {
  fetchOrigin(repo);
  const remote = `origin/${branch}`;
  if (checkedOut(repo, branch)) return;
  if (!branchExists(repo, branch)) {
    sh(repo.path, "git", "branch", branch, remote);
    return;
  }
  if (isMerged(repo, remote, branch)) return;
  if (!isMerged(repo, branch, remote)) throw new Error(`Local ${branch} has diverged from ${remote}.`);
  sh(repo.path, "git", "branch", "-f", branch, remote);
};

export const itemBranch = (repo: Repo, integration: string, slug: string): string => freeItemBranch(integration, slug, refNames(repo));

// Issues whose merge commit the branch carries past the repo's default branch, in first-merged order.
export const mergedIssues = (repo: Repo, branch: string): readonly number[] => issuesIn(mergeMessages(repo, branch));
