import { rootsOfBranches } from "../shared/branches.mjs";
import { log } from "../shared/logger.mjs";
import { rootState } from "../shared/repo.mjs";
import { sh } from "../shared/shell.mjs";
import type { Workspace } from "../shared/workspace.mjs";
import { planClean } from "../shared/worktrees.mjs";

// Removes the worktrees and local branches of every take whose root issue is closed, in every repo. Open roots are untouched.
export const clean = async (workspace: Workspace): Promise<void> => {
  const states = new Map<number, boolean>();
  const closedAmong = (roots: readonly number[]): ReadonlySet<number> => {
    roots.filter((root) => !states.has(root)).forEach((root) => states.set(root, rootState(workspace, root) === "CLOSED"));
    return new Set(roots.filter((root) => states.get(root) === true));
  };
  for (const repo of workspace.repos) {
    sh(repo.path, "git", "worktree", "prune");
    const branches = sh(repo.path, "git", "for-each-ref", "--format=%(refname:short)", "refs/heads/sandcastle/").split("\n").filter((branch) => branch !== "");
    const plan = planClean(workspace.home.name, sh(repo.path, "git", "worktree", "list", "--porcelain"), branches, closedAmong(rootsOfBranches(workspace.home.name, branches)));
    for (const path of plan.worktrees) {
      sh(repo.path, "git", "worktree", "remove", "--force", path);
      log.info(`${repo.name}: removed worktree ${path}`);
    }
    for (const branch of plan.branches) {
      sh(repo.path, "git", "branch", "-D", branch);
      log.info(`${repo.name}: deleted branch ${branch}`);
    }
    plan.kept.forEach((branch) => log.info(`${repo.name}: kept branch ${branch}: checked out in ${repo.path}`));
  }
};
