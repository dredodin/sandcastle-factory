import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { checkEnv, missingKeys, readValues, requiredKeys, writeValue, type Env, type Values } from "../shared/env.mjs";
import { log } from "../shared/logger.mjs";
import { repoDir, repoNamesByKey } from "../shared/names.mjs";
import { succeeds, sh } from "../shared/shell.mjs";
import { appRepoNames, readLayout, resolveWorkspace, type Layout, type Workspace } from "../shared/workspace.mjs";

const isGitRepo = (path: string): boolean => existsSync(path) && succeeds(path, "git", "rev-parse", "--git-dir");

const forwardSlashes = (path: string): string => path.trim().replace(/\\/g, "/");

const ask = async (question: string): Promise<string> => {
  if (!process.stdin.isTTY) throw new Error(`${question.trim()} Not set, and no terminal to ask on. Run \`setup\` in a terminal.`);
  const lines = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await lines.question(question)).trim();
  } finally {
    lines.close();
  }
};

// Asks for every missing value and appends it to `.env`; a repo path that is missing or no git repo is asked again, never cloned.
const fillEnv = async (layout: Layout): Promise<Values> => {
  const names = appRepoNames(layout);
  const repoOfKey = repoNamesByKey(names);
  const invalidPath = (values: Values, key: string): boolean => repoOfKey[key] !== undefined && values[key] !== undefined && !isGitRepo(values[key]);
  for (;;) {
    const values = readValues(layout.root);
    const key = requiredKeys(values, names).find((required) => (values[required] ?? "") === "" || invalidPath(values, required));
    if (key === undefined) return values;
    const repoName = repoOfKey[key];
    const answer = await ask(repoName === undefined ? `${key}: ` : `${key} (local path of ${repoName}, a git clone): `);
    if (answer === "") continue;
    if (repoName !== undefined && !isGitRepo(forwardSlashes(answer))) {
      log.warn(`${answer} is not a git repository.`);
      continue;
    }
    mkdirSync(`${layout.root}/.sandcastle`, { recursive: true });
    writeValue(layout.root, key, repoName === undefined ? answer : forwardSlashes(answer));
  }
};

// `.sandcastle/repos/<name>/source` points at the repo's folder; a junction on Windows, which needs no rights, a symlink elsewhere.
// Made anew every time, so a changed `REPO_<NAME>` path never leaves a stale link.
const linkSources = (workspace: Workspace): void => {
  for (const repo of workspace.repos.filter((candidate) => !candidate.isHome)) {
    const dir = `${workspace.root}/${repoDir(repo.name)}`;
    const link = `${dir}/source`;
    mkdirSync(dir, { recursive: true });
    if (isLink(link)) rmSync(link);
    symlinkSync(repo.path, link, process.platform === "win32" ? "junction" : "dir");
    log.info(`Linked ${link} → ${repo.path}`);
  }
};

const isLink = (path: string): boolean => {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
};

// One `repo:<name>` label per app repo, in the home repo, created only when absent. The home repo needs none: no label means it.
const createLabels = (workspace: Workspace): void => {
  const { home } = workspace;
  const present = new Set(sh(home.path, "gh", "label", "list", "--repo", home.slug, "--limit", "1000", "--json", "name", "--jq", ".[].name").split("\n"));
  for (const repo of workspace.repos.filter((candidate) => !candidate.isHome && !present.has(`repo:${candidate.name}`))) {
    sh(home.path, "gh", "label", "create", `repo:${repo.name}`, "--repo", home.slug, "--description", `Work in ${repo.slug}`);
  }
};

// Makes the machine ready for the Workspace of the current directory's repo; returns what a run needs.
export const setup = async (): Promise<{ readonly workspace: Workspace; readonly env: Env }> => {
  const layout = readLayout(process.cwd());
  const values = await fillEnv(layout);
  const names = appRepoNames(layout);
  if (missingKeys(values, names).length > 0) throw new Error("Setup left values missing.");
  const env = checkEnv(values, names);
  const workspace = resolveWorkspace(layout, env.repoPaths);
  linkSources(workspace);
  createLabels(workspace);
  for (const [key, value] of Object.entries(env.secrets)) process.env[key] ??= value;
  log.info(`Setup done: ${workspace.repos.map((repo) => repo.slug).join(", ")}; sandbox ${env.sandbox}.`);
  return { workspace, env };
};
