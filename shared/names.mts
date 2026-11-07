// Pure naming and parsing for the Workspace: no git, no gh, no files.

export type Slug = { readonly owner: string; readonly name: string };

// A repo's GitHub URL from its `owner/name`.
export const githubUrl = (slug: string): string => `https://github.com/${slug}`;

// `owner/name` of a GitHub remote URL (https or ssh, with or without `.git`); throws for any other host.
export const slugFromRemote = (url: string): Slug => {
  const remote = url.trim();
  const match = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(remote);
  if (match === null) throw new Error(`${remote} is not a GitHub remote.`);
  return { owner: match[1]!, name: match[2]! };
};

// Image names are lowercase; two Workspaces never share one because the home repo is part of it.
export const imageName = (home: string, repo: string): string => `sandcastle:${home}-${repo}`.toLowerCase();

// Where the Containerfile and the scripts of a repo live, relative to the home repo root.
export const repoDir = (repo: string): string => `.sandcastle/repos/${repo}`;

// The command agents run before every commit in a worktree of the repo.
export const verifyCommand = (repo: string): string => `bash ${repoDir(repo)}/verify.sh`;

// The command the review agent runs once per review pass, when the repo has a deep verify script.
export const deepVerifyCommand = (repo: string, base: string): string => `bash ${repoDir(repo)}/deep-verify.sh ${base}`;

// The command the plan agent runs each cycle, when the home repo has a plan check script.
export const planCheckCommand = (repo: string): string => `bash ${repoDir(repo)}/plan-check.sh`;

// A log file name. `number`: run-wide, so the folder sorts in start order.
export const logFileName = (number: number, base: string, repo: string): string => `${String(number).padStart(3, "0")}-${base}-${repo}.log`;

// Whether an app repo's `source` link is fine. `prefix`: `git rev-parse --show-prefix` in the link; null when it does not resolve or is not in a work tree. "" is a clone's root.
export const isCloneRoot = (prefix: string | null): boolean => prefix === "";
