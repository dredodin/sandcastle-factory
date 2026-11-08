import { rootOfBranch } from "../shared/branches.mjs";
import { log } from "../shared/logger.mjs";
import { sh } from "../shared/shell.mjs";
import type { Repo, Workspace } from "../shared/workspace.mjs";
import { z } from "zod";

const stateSchema = z.object({ state: z.string() });

const isClosed = (workspace: Workspace, root: number): boolean => {
  const { home } = workspace;
  return stateSchema.parse(JSON.parse(sh(home.path, "gh", "issue", "view", `${root}`, "--repo", home.slug, "--json", "state"))).state === "CLOSED";
};

type Worktree = { readonly path: string; readonly branch: string };

// Linked worktrees on a branch; the repo's main working tree is never one.
const linkedWorktrees = (repo: Repo): readonly Worktree[] =>
  sh(repo.path, "git", "worktree", "list", "--porcelain")
    .split("\n\n")
    .map((block) => block.split("\n"))
    .flatMap((lines) => {
      const path = lines[0]?.replace(/^worktree /, "") ?? "";
      const branch = lines.find((line) => line.startsWith("branch refs/heads/"))?.replace("branch refs/heads/", "");
      return branch === undefined || path === repo.path ? [] : [{ path, branch }];
    });

// Removes the worktrees and local branches of every take whose root issue is closed, in every repo. Open roots are untouched.
export const clean = async (workspace: Workspace): Promise<void> => {
  const closed = new Map<number, boolean>();
  const isRootClosed = (root: number): boolean => {
    if (!closed.has(root)) closed.set(root, isClosed(workspace, root));
    return closed.get(root) === true;
  };
  const finished = (branch: string): boolean => {
    const root = rootOfBranch(workspace.home.name, branch);
    return root !== undefined && isRootClosed(root);
  };
  for (const repo of workspace.repos) {
    sh(repo.path, "git", "worktree", "prune");
    for (const { path, branch } of linkedWorktrees(repo).filter((worktree) => finished(worktree.branch))) {
      sh(repo.path, "git", "worktree", "remove", "--force", path);
      log.info(`${repo.name}: removed worktree ${path}`);
    }
    const branches = sh(repo.path, "git", "for-each-ref", "--format=%(refname:short)", "refs/heads/sandcastle/").split("\n").filter((branch) => branch !== "");
    for (const branch of branches.filter(finished)) {
      sh(repo.path, "git", "branch", "-D", branch);
      log.info(`${repo.name}: deleted branch ${branch}`);
    }
  }
};
