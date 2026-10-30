// Pure text blocks the prompts are given: the Workspace's repos and the run's state in them.

import type { RepoRef } from "./item.mjs";

export type RepoLine = RepoRef & { readonly defaultBranch: string };

// Every repo of the Workspace with the label that routes an issue to it.
export const reposText = (home: string, repos: readonly RepoLine[]): string =>
  repos
    .map((repo) => `- \`${repo.name}\` — ${repo.slug}, default branch \`${repo.defaultBranch}\`, label \`repo:${repo.name}\`${repo.name === home ? " (the home repo: also issues without a `repo:` label)" : ""}`)
    .join("\n");

// The integration branch in the repos other than `current` that have one so far.
export const otherBranchesText = (repos: readonly RepoRef[], current: string, branch: string): string => {
  const others = repos.filter((repo) => repo.name !== current);
  return others.length === 0 ? "(no other repo has a branch yet)" : others.map((repo) => `- \`${repo.name}\` (${repo.slug}): \`${branch}\``).join("\n");
};

export type RepoState = {
  readonly repo: string;
  // False until the repo's integration worktree was opened.
  readonly opened: boolean;
  readonly merged: readonly number[];
};

// What is on the run's branches so far, per repo.
export const stateText = (branch: string, states: readonly RepoState[]): string =>
  states
    .map((state) => {
      if (!state.opened) return `- \`${state.repo}\`: no branch yet`;
      const merged = state.merged.length === 0 ? "none" : state.merged.map((id) => `#${id}`).join(", ");
      return `- \`${state.repo}\`: \`${branch}\` carries merged issues: ${merged}`;
    })
    .join("\n");
