// The Workspace: the home repo and the repos worked together with it. Read from the current directory's repo root only.

import { existsSync, lstatSync, readdirSync, realpathSync } from "node:fs";
import { repoDir, slugFromRemote, type Slug } from "./names.mjs";
import { sh } from "./shell.mjs";

export type Repo = {
  readonly name: string;
  readonly path: string;
  readonly slug: string;
  readonly defaultBranch: string;
  // The ref every branch of a take is cut from.
  readonly base: string;
  readonly isHome: boolean;
};

export type Workspace = {
  readonly root: string;
  readonly home: Repo;
  // The home repo first, then every other folder of `.sandcastle/repos/`.
  readonly repos: readonly Repo[];
};

export type Layout = {
  readonly root: string;
  readonly homeName: string;
  readonly homeSlug: string;
  // Folders of `.sandcastle/repos/` other than the home repo's, sorted.
  readonly apps: readonly string[];
};

const originSlug = (path: string): Slug => slugFromRemote(sh(path, "git", "remote", "get-url", "origin"));

// Reads the home repo's identity and its repo list. No `.env`, no network.
export const readLayout = (cwd: string): Layout => {
  const root = sh(cwd, "git", "rev-parse", "--show-toplevel");
  const home = originSlug(root);
  const dir = `${root}/.sandcastle/repos`;
  const folders = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name) : [];
  return { root, homeName: home.name, homeSlug: `${home.owner}/${home.name}`, apps: folders.filter((name) => name !== home.name).sort() };
};

const isLink = (path: string): boolean => {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
};

export type SourceState = {
  readonly linked: boolean;
  readonly resolves: boolean;
  // The link's real path; "" when it does not resolve.
  readonly real: string;
  // `git rev-parse --show-toplevel` in the link's target; "" when that is not in a git work tree.
  readonly toplevel: string;
};

const samePath = (a: string, b: string): boolean => a.replace(/\\/g, "/") === b.replace(/\\/g, "/");

// What is wrong with an app repo's `source` link: empty when nothing. The target must be the clone's root, not a folder in it.
export const sourceProblem = (name: string, state: SourceState): readonly string[] => {
  if (!state.linked && !state.resolves) return [`${name}: no source link — run onboarding`];
  if (!state.resolves || !samePath(state.toplevel, state.real)) return [`${name}: source link is not a git clone — run onboarding`];
  return [];
};

const toplevelOf = (path: string): string => {
  try {
    return sh(path, "git", "rev-parse", "--show-toplevel");
  } catch {
    return "";
  }
};

// Where an app repo's clone is: its `source` link, which must resolve to the root of a git clone.
const sourceOf = (root: string, name: string): string => {
  const link = `${root}/${repoDir(name)}/source`;
  const resolves = existsSync(link);
  const real = resolves ? realpathSync(link) : "";
  const [problem] = sourceProblem(name, { linked: isLink(link), resolves, real, toplevel: resolves ? toplevelOf(link) : "" });
  if (problem !== undefined) throw new Error(problem);
  return real;
};

// Every app repo's clone path by name; throws naming the first repo whose link is missing or broken.
export const sourcePaths = (layout: Layout): Readonly<Record<string, string>> =>
  Object.fromEntries(layout.apps.map((name) => [name, sourceOf(layout.root, name)]));

const repoAt = (name: string, path: string, isHome: boolean): Repo => {
  const slug = originSlug(path);
  const defaultBranch = sh(path, "gh", "repo", "view", `${slug.owner}/${slug.name}`, "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name");
  return { name, path, slug: `${slug.owner}/${slug.name}`, defaultBranch, base: `origin/${defaultBranch}`, isHome };
};

// Resolves every repo's slug and default branch from its folder's `origin` and GitHub.
export const resolveWorkspace = (layout: Layout, sources: Readonly<Record<string, string>>): Workspace => {
  const home = repoAt(layout.homeName, layout.root, true);
  const apps = layout.apps.map((name) => repoAt(name, sources[name] ?? "", false));
  return { root: layout.root, home, repos: [home, ...apps] };
};

export const repoNamed = (workspace: Workspace, name: string): Repo => {
  const repo = workspace.repos.find((candidate) => candidate.name === name);
  if (repo === undefined) throw new Error(`Unknown repo "${name}". Known: ${workspace.repos.map((r) => r.name).join(", ")}.`);
  return repo;
};
