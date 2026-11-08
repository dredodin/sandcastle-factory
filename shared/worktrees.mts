import { basename } from "node:path";
import { branchesOfRoots, rootOfFolder } from "./branches.mjs";

// A worktree of `git worktree list --porcelain`; branch is null when detached.
export type Worktree = { readonly path: string; readonly branch: string | null };

// Main working tree first, as git lists it, then the linked worktrees.
export const parseWorktrees = (porcelain: string): readonly Worktree[] =>
  porcelain.split("\n\n").flatMap((block) => {
    const path = /^worktree (.+)$/m.exec(block)?.[1];
    return path === undefined ? [] : [{ path, branch: /^branch refs\/heads\/(.+)$/m.exec(block)?.[1] ?? null }];
  });

export type CleanPlan = {
  readonly worktrees: readonly string[];
  readonly branches: readonly string[];
  // Branches of closed roots that the main working tree has checked out: they cannot be deleted.
  readonly kept: readonly string[];
};

// What `clean` removes in one repo: linked worktrees (a detached one by its folder name) and local branches of the closed roots. The main working tree is never removed.
export const planClean = (home: string, porcelain: string, branches: readonly string[], closedRoots: ReadonlySet<number>): CleanPlan => {
  const [main, ...linked] = parseWorktrees(porcelain);
  const finished = new Set(branchesOfRoots(home, branches, closedRoots));
  const checkedOutInMain = (branch: string): boolean => main?.branch === branch;
  return {
    worktrees: linked.filter(({ path, branch }) => (branch === null ? rootOfFolder(home, basename(path)).some((root) => closedRoots.has(root)) : finished.has(branch))).map(({ path }) => path),
    branches: [...finished].filter((branch) => !checkedOutInMain(branch)),
    kept: [...finished].filter(checkedOutInMain),
  };
};
