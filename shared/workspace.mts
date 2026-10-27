// The Workspace: the home repo and the repos worked together with it. Read from the current directory's repo root only.

import { existsSync, readFileSync } from "node:fs";
import { repoNamesFromMap, slugFromRemote, type Slug } from "./names.mjs";
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
  // The home repo first, then every other repo of GLOSSARY-MAP.
  readonly repos: readonly Repo[];
};

export type Layout = {
  readonly root: string;
  readonly homeName: string;
  readonly homeSlug: string;
  // Repo names GLOSSARY-MAP links to; may include the home repo's own name.
  readonly mapped: readonly string[];
};

const originSlug = (path: string): Slug => slugFromRemote(sh(path, "git", "remote", "get-url", "origin"));

// Reads the home repo's identity and its repo list. No `.env`, no network. No GLOSSARY-MAP: the home repo alone.
export const readLayout = (cwd: string): Layout => {
  const root = sh(cwd, "git", "rev-parse", "--show-toplevel");
  const home = originSlug(root);
  const map = `${root}/GLOSSARY-MAP.md`;
  return { root, homeName: home.name, homeSlug: `${home.owner}/${home.name}`, mapped: existsSync(map) ? repoNamesFromMap(readFileSync(map, "utf8")) : [] };
};

// Repos other than the home repo, which need a local path in `.env`.
export const appRepoNames = (layout: Layout): readonly string[] => layout.mapped.filter((name) => name !== layout.homeName);

const repoAt = (name: string, path: string, isHome: boolean): Repo => {
  const slug = originSlug(path);
  const defaultBranch = sh(path, "gh", "repo", "view", `${slug.owner}/${slug.name}`, "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name");
  return { name, path, slug: `${slug.owner}/${slug.name}`, defaultBranch, base: `origin/${defaultBranch}`, isHome };
};

// Resolves every repo's slug and default branch from its folder's `origin` and GitHub.
export const resolveWorkspace = (layout: Layout, repoPaths: Readonly<Record<string, string>>): Workspace => {
  const home = repoAt(layout.homeName, layout.root, true);
  const apps = appRepoNames(layout).map((name) => repoAt(name, repoPaths[name] ?? "", false));
  return { root: layout.root, home, repos: [home, ...apps] };
};

export const repoNamed = (workspace: Workspace, name: string): Repo => {
  const repo = workspace.repos.find((candidate) => candidate.name === name);
  if (repo === undefined) throw new Error(`Unknown repo "${name}". Known: ${workspace.repos.map((r) => r.name).join(", ")}.`);
  return repo;
};
