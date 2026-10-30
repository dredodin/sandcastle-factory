// Pure naming and parsing for the Workspace: no git, no gh, no files.

const MAP_LINK = /\]\(\s*<?(?:\.\/)?\.sandcastle\/repos\/([^/)>\s]+)\//g;

// Repo names the home repo's GLOSSARY-MAP links to as `.sandcastle/repos/<name>/…`, each once, in order.
export const repoNamesFromMap = (map: string): readonly string[] => [...new Set([...map.matchAll(MAP_LINK)].map((match) => match[1]!))];

// The `.env` key holding a repo's local path.
export const repoKey = (name: string): string => `REPO_${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;

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

// A log file name; app repos get their name as a suffix, the home repo keeps the plain name.
export const logFileName = (base: string, repo: string, home: string): string => (repo === home ? base : `${base}-${repo}`);
