import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Command } from "../shared/cli.mjs";
import { EFFORTS, PHASES, PROVIDERS, SANDBOXES, checkEnv, envPath, missingKeys, readValues, withHints, withShellOverrides, type Env, type Values } from "../shared/env.mjs";
import { log } from "../shared/logger.mjs";
import { imageName, repoDir } from "../shared/names.mjs";
import { hostCodexLogin } from "../shared/paths.mjs";
import { succeeds, sh } from "../shared/shell.mjs";
import { readLayout, resolveWorkspace, sourcePaths, type Layout, type Workspace } from "../shared/workspace.mjs";

const forwardSlashes = (path: string): string => path.replace(/\\/g, "/");
const WIZARD = forwardSlashes(fileURLToPath(new URL("./wizard.sh", import.meta.url)));
const FACTORY_DIR = forwardSlashes(fileURLToPath(new URL("..", import.meta.url)));
// The image every repo image starts FROM, built from FACTORY_DIR.
const BASE_IMAGE = "sandcastle-factory:base";

const hasCodexLogin = (): boolean => existsSync(hostCodexLogin());

// `.env` with the shell's overrides; nothing else is read.
const settingsOf = (layout: Layout): Values => withShellOverrides(readValues(layout.root), process.env);

// What the wizard is handed, so bash holds no copy of the factory's lists.
const wizardEnv = (layout: Layout): Values => ({
  ENV_FILE: envPath(layout.root),
  WIZARD_PHASES: PHASES.join(" "),
  WIZARD_EFFORTS: PROVIDERS.map((provider) => [provider, ...EFFORTS[provider]].join(" ")).join("\n"),
  WIZARD_SANDBOXES: SANDBOXES.join(" "),
  WIZARD_HOME_SLUG: layout.homeSlug,
  WIZARD_BASE_IMAGE: BASE_IMAGE,
  WIZARD_IMAGES: [layout.homeName, ...layout.apps].map((name) => `${imageName(layout.homeName, name)} ${repoDir(name)}/Containerfile`).join("\n"),
  WIZARD_FACTORY_DIR: FACTORY_DIR,
  WIZARD_CODEX_LOGIN: hasCodexLogin() ? "1" : "",
});

// The wizard is the only writer of `.env`.
const runWizard = (layout: Layout): void => {
  mkdirSync(`${layout.root}/.sandcastle`, { recursive: true });
  const result = spawnSync("bash", [WIZARD], { cwd: layout.root, stdio: "inherit", env: { ...process.env, ...wizardEnv(layout) } });
  if (result.status !== 0) throw new Error("The setup wizard stopped before the end.");
};

// One `repo:<name>` label per app repo, in the home repo, created only when absent. The home repo needs none: no label means it.
const createLabels = (workspace: Workspace): void => {
  const { home } = workspace;
  const present = new Set(sh(home.path, "gh", "label", "list", "--repo", home.slug, "--limit", "1000", "--json", "name", "--jq", ".[].name").split("\n"));
  for (const repo of workspace.repos.filter((candidate) => !candidate.isHome && !present.has(`repo:${candidate.name}`))) {
    sh(home.path, "gh", "label", "create", `repo:${repo.name}`, "--repo", home.slug, "--description", `Work in ${repo.slug}`);
  }
};

// A stopped Podman machine is started; no machine at all (Linux, native Podman) is left alone.
const startPodmanMachine = (cwd: string): void => {
  if (!succeeds(cwd, "podman", "machine", "inspect")) return;
  const state = sh(cwd, "podman", "machine", "inspect", "--format", "{{.State}}");
  if (state === "running") return;
  log.info(`Podman machine is ${state}: starting it.`);
  sh(cwd, "podman", "machine", "start");
};

// Makes the machine ready for the Workspace of the current directory's repo; returns what a run needs.
// In a terminal, the wizard opens: always for `setup`, only when something is missing for a run.
export const setup = async (mode: Command["mode"]): Promise<{ readonly workspace: Workspace; readonly env: Env }> => {
  const layout = readLayout(process.cwd());
  const sources = sourcePaths(layout);
  if (process.stdin.isTTY && (mode === "setup" || missingKeys(settingsOf(layout), hasCodexLogin()).length > 0)) runWizard(layout);
  const values = settingsOf(layout);
  const left = missingKeys(values, hasCodexLogin());
  if (left.length > 0) throw new Error(`Missing in .sandcastle/.env: ${withHints(left)}. A human runs \`npm run sandcastle -- setup\` in their terminal.`);
  const env = checkEnv(values, hasCodexLogin());
  if (env.sandbox === "podman") startPodmanMachine(layout.root);
  const workspace = resolveWorkspace(layout, sources);
  createLabels(workspace);
  for (const [key, value] of Object.entries(env.secrets)) process.env[key] ??= value;
  log.info(`Setup done: ${workspace.repos.map((repo) => repo.slug).join(", ")}; sandbox ${env.sandbox}.`);
  return { workspace, env };
};
