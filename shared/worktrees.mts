import { branchesOfRoots } from "./branches.mjs";

// A worktree of `git worktree list --porcelain`; branch is null when detached.
export type Worktree = { readonly path: string; readonly branch: string | null };

// Main working tree first, as git lists it, then the linked worktrees.
export const parseWorktrees = (porcelain: string): readonly Worktree[] =>
  porcelain
    .split("\n\n")
    .map((block) => block.split("\n"))
    .filter((lines) => lines[0]?.startsWith("worktree "))
    .map((lines) => ({
      path: (lines[0] ?? "").slice("worktree ".length),
      branch: lines.find((line) => line.startsWith("branch refs/heads/"))?.slice("branch refs/heads/".length) ?? null,
    }));

export type CleanPlan = {
  readonly worktrees: readonly string[];
  readonly branches: readonly string[];
  // Branches of closed roots that the main working tree has checked out: they cannot be deleted.
  readonly kept: readonly string[];
};

// What `clean` removes in one repo: linked worktrees and local branches of the closed roots. The main working tree is never removed.
export const planClean = (home: string, porcelain: string, branches: readonly string[], closedRoots: ReadonlySet<number>): CleanPlan => {
  const [main, ...linked] = parseWorktrees(porcelain);
  const finished = new Set(branchesOfRoots(home, branches, closedRoots));
  const checkedOutInMain = (branch: string): boolean => main?.branch === branch;
  return {
    worktrees: linked.filter(({ branch }) => branch !== null && finished.has(branch)).map(({ path }) => path),
    branches: [...finished].filter((branch) => !checkedOutInMain(branch)),
    kept: [...finished].filter(checkedOutInMain),
  };
};
