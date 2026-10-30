import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ConstantBackoff, handleAll, retry } from "cockatiel";
import { createWorktree, type Sandbox, type SandboxProvider } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import { podman } from "@ai-hero/sandcastle/sandboxes/podman";
import { message } from "./cli.mjs";
import type { Env } from "./env.mjs";
import { log, timed } from "./logger.mjs";
import { imageName, repoDir } from "./names.mjs";
import { branchExists, worktreeOf } from "./repo.mjs";
import { sh, shIn } from "./shell.mjs";
import type { Repo, Workspace } from "./workspace.mjs";

const TEARDOWN_ATTEMPTS = 3;
const TEARDOWN_BACKOFF_MS = 500;
const NO_SUCH_CONTAINER = /no such container/i;
const SPARSE_LIST = "sparse-checkout";
const COPIED_FILES = ["setup.sh", "verify.sh", "deep-verify.sh", "plan-check.sh", "CODING_STANDARDS.md"] as const;
const SETUP_OUTPUT_TAIL = 2000;

const teardownRetry = retry(handleAll, { maxAttempts: TEARDOWN_ATTEMPTS - 1, backoff: new ConstantBackoff(TEARDOWN_BACKOFF_MS) });

// Where the sandboxes of a run get their rights: the Workspace, and the machine's `.env`.
export type SandboxContext = { readonly workspace: Workspace; readonly env: Env };

// One sandbox: a worktree of one repo on one branch, cut from `baseBranch`. `name`: the item's slug, or `integration`.
export type SandboxSpec = { readonly repo: Repo; readonly name: string; readonly branch: string; readonly baseBranch: string };

const providerFor = ({ workspace, env }: SandboxContext, repo: Repo): SandboxProvider => {
  const options = { imageName: imageName(workspace.home.name, repo.name), env: env.secrets };
  if (env.sandbox === "docker") return docker(options);
  if (env.sandbox === "podman") return podman(options);
  return noSandbox({ env: env.secrets });
};

// Teardown is a side effect: retried, then logged, never thrown.
// "No such container" counts as success: an earlier attempt may have removed it yet reported an error.
const closeSandbox = async (sandbox: Sandbox, branch: string): Promise<void> => {
  const close = async (): Promise<void> => {
    await sandbox.close().catch((error: unknown) => {
      if (NO_SUCH_CONTAINER.test(message(error))) return;
      throw error;
    });
  };
  await teardownRetry.execute(close).catch((error: unknown) => {
    log.error(`sandbox teardown failed for ${branch}: ${message(error)}`);
  });
};

// An app repo carries nothing of the factory: keep the copied scripts and sandcastle's own folders out of its `git status`.
const excludeFactoryFiles = (repo: Repo): void => {
  const exclude = resolve(repo.path, sh(repo.path, "git", "rev-parse", "--git-path", "info/exclude"));
  mkdirSync(dirname(exclude), { recursive: true });
  const present = existsSync(exclude) ? readFileSync(exclude, "utf8").split("\n") : [];
  if (!present.includes("/.sandcastle/")) appendFileSync(exclude, `${present.at(-1) === "" || present.length === 0 ? "" : "\n"}/.sandcastle/\n`);
};

// A file of the repo's sandbox folder in the home repo.
const homeFile = (workspace: Workspace, repo: Repo, file: string): string => `${workspace.root}/${repoDir(repo.name)}/${file}`;

// The repo's own scripts and personal standards live in the home repo; the worktree gets those that exist, at the same path.
const copyRepoFiles = (workspace: Workspace, repo: Repo, worktreePath: string): void => {
  for (const file of COPIED_FILES) {
    const from = homeFile(workspace, repo, file);
    const to = `${worktreePath}/${repoDir(repo.name)}/${file}`;
    if (existsSync(to) || !existsSync(from)) continue;
    cpSync(from, to, { recursive: true });
  }
};

// With the repo's sparse list and no worktree on the branch yet, makes the worktree checked out per that list;
// `createWorktree` then reuses it as is.
const makeLightWorktree = (workspace: Workspace, { repo, branch, baseBranch }: SandboxSpec): void => {
  const listPath = homeFile(workspace, repo, SPARSE_LIST);
  if (!existsSync(listPath)) return;
  if (worktreeOf(repo, branch) !== undefined) return;
  const path = `${repo.path}/.sandcastle/worktrees/${branch.replaceAll("/", "-")}`;
  const target = branchExists(repo, branch) ? [path, branch] : ["-b", branch, path, baseBranch];
  sh(repo.path, "git", "worktree", "add", "--no-checkout", ...target);
  shIn(path, readFileSync(listPath, "utf8"), "git", "sparse-checkout", "set", "--no-cone", "--stdin");
  sh(path, "git", "reset", "--hard", "HEAD");
};

type Opened = {
  readonly sandbox: Sandbox;
  readonly worktreePath: string;
  // Always called; never throws.
  readonly teardown: () => Promise<void>;
  // Removes the worktree; throws when it holds uncommitted changes.
  readonly finish: () => Promise<void>;
};

const open = async (context: SandboxContext, spec: SandboxSpec): Promise<Opened> => {
  const { repo, name, branch, baseBranch } = spec;
  const step = `open ${repo.name} ${name}:`;
  if (!repo.isHome) excludeFactoryFiles(repo);
  const worktree = await timed(`${step} worktree`, () => {
    makeLightWorktree(context.workspace, spec);
    return createWorktree({ cwd: repo.path, branchStrategy: { type: "branch", branch, baseBranch } });
  });
  const kept = (reason: string): Error => new Error(`${reason} (worktree kept: ${worktree.worktreePath})`);
  try {
    copyRepoFiles(context.workspace, repo, worktree.worktreePath);
  } catch (error) {
    throw kept(message(error));
  }

  const sandbox = await timed(`${step} sandbox`, () => worktree.createSandbox({ sandbox: providerFor(context, repo) })).catch((error: unknown) => {
    throw kept(message(error));
  });
  // A failed step closes the sandbox and keeps the worktree.
  const prepare = async (label: string, command: string): Promise<void> => {
    const result = await timed(`${step} ${label}`, () => sandbox.exec(command)).catch(async (error: unknown) => {
      await closeSandbox(sandbox, branch);
      throw kept(`${command}: ${message(error)}`);
    });
    if (result.exitCode === 0) return;
    await closeSandbox(sandbox, branch);
    throw kept(`${command} exited ${result.exitCode}: ${`${result.stdout}\n${result.stderr}`.trim().slice(-SETUP_OUTPUT_TAIL)}`);
  };
  // git pushes and fetches with the run's GitHub token, the same in every phase.
  await prepare("git auth", "gh auth setup-git");
  await prepare("setup.sh", `bash ${repoDir(repo.name)}/setup.sh`);

  return {
    sandbox,
    worktreePath: worktree.worktreePath,
    teardown: () => closeSandbox(sandbox, branch),
    finish: async () => {
      const { preservedWorktreePath } = await worktree.close();
      if (preservedWorktreePath) throw new Error(`uncommitted changes (worktree kept: ${preservedWorktreePath})`);
    },
  };
};

// Runs `use` in a fresh worktree of one repo with a sandbox over it.
// The sandbox is always closed; a teardown failure is logged, never decides the outcome.
// The worktree is removed only on success; on any failure,
// or if `use` left uncommitted changes, it is kept for diagnosis and the error names its path.
export const withSandbox = async <T,>(context: SandboxContext, spec: SandboxSpec, use: (sandbox: Sandbox) => Promise<T>): Promise<T> => {
  const opened = await open(context, spec);
  const result = await use(opened.sandbox)
    .catch((error: unknown) => {
      throw new Error(`${message(error)} (worktree kept: ${opened.worktreePath})`);
    })
    .finally(opened.teardown);
  await opened.finish();
  return result;
};

// The integration worktree of each repo of a run, opened the first time the repo is needed.
export type Integrations = {
  readonly get: (repo: Repo) => Promise<Sandbox>;
  // Repos opened so far, in opening order.
  readonly opened: () => readonly Repo[];
};

// Runs `use` with lazily opened integration worktrees; same closing rules as `withSandbox`, for all of them.
export const withIntegrations = async <T,>(
  context: SandboxContext,
  specFor: (repo: Repo) => Omit<SandboxSpec, "name">,
  use: (integrations: Integrations) => Promise<T>,
): Promise<T> => {
  const all = new Map<string, { readonly repo: Repo; readonly opening: Promise<Opened> }>();
  const integrations: Integrations = {
    get: async (repo) => {
      const existing = all.get(repo.name) ?? { repo, opening: open(context, { ...specFor(repo), name: "integration" }) };
      all.set(repo.name, existing);
      return (await existing.opening).sandbox;
    },
    opened: () => [...all.values()].map((entry) => entry.repo),
  };

  const settled = async (): Promise<Opened[]> =>
    (await Promise.allSettled([...all.values()].map((entry) => entry.opening))).flatMap((outcome) => (outcome.status === "fulfilled" ? [outcome.value] : []));

  const result = await use(integrations).catch(async (error: unknown) => {
    const opened = await settled();
    await Promise.all(opened.map((one) => one.teardown()));
    const paths = opened.map((one) => one.worktreePath);
    throw new Error(`${message(error)}${paths.length > 0 ? ` (worktrees kept: ${paths.join(", ")})` : ""}`);
  });

  const opened = await settled();
  await Promise.all(opened.map((one) => one.teardown()));
  const finished = await Promise.allSettled(opened.map((one) => one.finish()));
  const problems = finished.flatMap((outcome) => (outcome.status === "rejected" ? [message(outcome.reason)] : []));
  if (problems.length > 0) throw new Error(problems.join("; "));
  return result;
};
