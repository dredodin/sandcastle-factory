// `.sandcastle/.env` in the home repo: the one per-machine file. Checked by a schema the factory owns.

import { existsSync, readFileSync } from "node:fs";
import { parseEnv as parseDotenv } from "node:util";
import { z } from "zod";
import type { Kanban } from "./kanban.mjs";
import { repoKey } from "./names.mjs";

export const PHASES = ["PLAN", "IMPLEMENT", "REVIEW", "MERGE", "PR"] as const;
export type Phase = (typeof PHASES)[number];
export const PROVIDERS = ["claudeCode", "copilot", "codex"] as const;
export type Provider = (typeof PROVIDERS)[number];
// Every effort a provider accepts, lowest first.
export const EFFORTS = {
  claudeCode: ["low", "medium", "high", "xhigh", "max"],
  copilot: ["low", "medium", "high"],
  codex: ["low", "medium", "high", "xhigh"],
} as const satisfies Readonly<Record<Provider, readonly string[]>>;
export const SANDBOXES = ["podman", "docker", "none"] as const;
export type PhaseSetting = { readonly provider: Provider; readonly model: string; readonly effort: string };
export type Values = Readonly<Record<string, string>>;

export type Env = {
  readonly sandbox: (typeof SANDBOXES)[number];
  readonly phases: Readonly<Record<Phase, PhaseSetting>>;
  // The tokens the sandbox and the agents get, by name.
  readonly secrets: Values;
  // Whether sandboxes get the host's Codex login file: a phase uses codex, no `CODEX_API_KEY`, and the host has the login.
  readonly mountCodexLogin: boolean;
  // Local path of every repo that is not the home repo, by repo name.
  readonly repoPaths: Values;
  // The home repo's Kanban.
  readonly kanban: Kanban;
};

const CLAUDE_AUTH = ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY"] as const;
const COPILOT_TOKEN = "COPILOT_GITHUB_TOKEN";
const CODEX_KEY = "CODEX_API_KEY";
// What a human does about a missing key, where a bare name is not enough.
const KEY_HINTS: Readonly<Record<string, string>> = { [CODEX_KEY]: "run codex login or set CODEX_API_KEY" };

// The missing keys as one list, each with its hint.
export const withHints = (keys: readonly string[]): string => keys.map((key) => (KEY_HINTS[key] ? `${key} (${KEY_HINTS[key]})` : key)).join(", ");

const KANBAN_KEYS = ["KANBAN_OWNER", "KANBAN_NUMBER"] as const;

const SECRET_KEYS = ["GH_TOKEN", ...CLAUDE_AUTH, COPILOT_TOKEN, CODEX_KEY] as const;

const phaseKeys = (phase: Phase): readonly string[] => [`${phase}_PROVIDER`, `${phase}_MODEL`, `${phase}_EFFORT`];

const has = (values: Values, key: string): boolean => (values[key] ?? "") !== "";

// Every key the machine needs, given the values so far.
// Provider-dependent keys appear once the providers are known.
const requiredKeys = (values: Values, repoNames: readonly string[], hostLogin: boolean): readonly string[] => {
  const providers = PHASES.map((phase) => values[`${phase}_PROVIDER`]);
  const claudeAuth = CLAUDE_AUTH.find((key) => has(values, key)) ?? CLAUDE_AUTH[0];
  return [
    "GH_TOKEN",
    "SANDBOX",
    ...PHASES.flatMap(phaseKeys),
    ...KANBAN_KEYS,
    ...(providers.includes("claudeCode") ? [claudeAuth] : []),
    ...(providers.includes("copilot") ? [COPILOT_TOKEN] : []),
    ...(providers.includes("codex") && !hostLogin ? [CODEX_KEY] : []),
    ...repoNames.map(repoKey),
  ];
};

// `hostLogin`: the host has a Codex login file, which stands in for `CODEX_API_KEY`.
export const missingKeys = (values: Values, repoNames: readonly string[], hostLogin: boolean): readonly string[] =>
  requiredKeys(values, repoNames, hostLogin).filter((key) => !has(values, key));

export const envPath = (root: string): string => `${root}/.sandcastle/.env`;

// The non-blank values of `.env`; nothing comes from the shell environment.
export const readValues = (root: string): Values => {
  const file = existsSync(envPath(root)) ? parseDotenv(readFileSync(envPath(root), "utf8")) : {};
  return Object.fromEntries(Object.entries(file).filter((entry): entry is [string, string] => (entry[1] ?? "") !== ""));
};

// Keys the factory reads: the only ones a shell variable may set.
const knownKeys = (repoNames: readonly string[]): readonly string[] => ["GH_TOKEN", "SANDBOX", ...PHASES.flatMap(phaseKeys), ...KANBAN_KEYS, ...CLAUDE_AUTH, COPILOT_TOKEN, CODEX_KEY, ...repoNames.map(repoKey)];

// `.env` values with the shell's non-empty values of known keys over them: a shell variable overrides `.env` for one run.
export const withShellOverrides = (file: Values, shell: Readonly<Record<string, string | undefined>>, repoNames: readonly string[]): Values => ({
  ...file,
  ...Object.fromEntries(
    knownKeys(repoNames).flatMap((key) => {
      const value = shell[key] ?? "";
      return value === "" ? [] : [[key, value]];
    }),
  ),
});

const nonEmpty = z.string().min(1);

const schemaFor = (repoNames: readonly string[], hostLogin: boolean): z.ZodType<Record<string, string | undefined>> =>
  z
    .object({
      GH_TOKEN: nonEmpty,
      SANDBOX: z.enum(SANDBOXES),
      KANBAN_OWNER: nonEmpty,
      KANBAN_NUMBER: z.string().regex(/^[1-9][0-9]*$/, "a project number"),
      CLAUDE_CODE_OAUTH_TOKEN: nonEmpty.optional(),
      ANTHROPIC_API_KEY: nonEmpty.optional(),
      COPILOT_GITHUB_TOKEN: nonEmpty.optional(),
      CODEX_API_KEY: nonEmpty.optional(),
      ...Object.fromEntries(PHASES.flatMap((phase) => [[`${phase}_PROVIDER`, z.enum(PROVIDERS)], [`${phase}_MODEL`, nonEmpty], [`${phase}_EFFORT`, nonEmpty]])),
      ...Object.fromEntries(repoNames.map((name) => [repoKey(name), nonEmpty])),
    })
    .loose()
    .superRefine((values, ctx) => {
      const providers = PHASES.map((phase) => values[`${phase}_PROVIDER`]);
      if (providers.includes("claudeCode") && !CLAUDE_AUTH.some((key) => values[key])) {
        ctx.addIssue({ code: "custom", path: [CLAUDE_AUTH[0]], message: "set CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY" });
      }
      if (providers.includes("copilot") && !values[COPILOT_TOKEN]) {
        ctx.addIssue({ code: "custom", path: [COPILOT_TOKEN], message: "a phase uses copilot" });
      }
      if (providers.includes("codex") && !values[CODEX_KEY] && !hostLogin) {
        ctx.addIssue({ code: "custom", path: [CODEX_KEY], message: KEY_HINTS[CODEX_KEY] ?? "" });
      }
    }) as z.ZodType<Record<string, string | undefined>>;

// The checked environment; throws naming every missing or invalid key. `repoNames` are the repos other than the home repo.
// `hostLogin`: see `missingKeys`.
export const checkEnv = (values: Values, repoNames: readonly string[], hostLogin: boolean): Env => {
  const parsed = schemaFor(repoNames, hostLogin).safeParse(values);
  if (!parsed.success) {
    const keys = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "?")))];
    throw new Error(`.sandcastle/.env is incomplete or wrong, fix: ${keys.join(", ")}. Run \`setup\` to fill the missing ones.`);
  }
  const value = (key: string): string => parsed.data[key] ?? "";
  const phases = Object.fromEntries(
    PHASES.map((phase) => [phase, { provider: value(`${phase}_PROVIDER`), model: value(`${phase}_MODEL`), effort: value(`${phase}_EFFORT`) }]),
  ) as Record<Phase, PhaseSetting>;
  const secrets = Object.fromEntries(SECRET_KEYS.flatMap((key) => (parsed.data[key] ? [[key, value(key)]] : [])));
  const repoPaths = Object.fromEntries(repoNames.map((name) => [name, value(repoKey(name))]));
  const mountCodexLogin = hostLogin && value(CODEX_KEY) === "" && PHASES.some((phase) => phases[phase].provider === "codex");
  const kanban = { owner: value("KANBAN_OWNER"), number: Number(value("KANBAN_NUMBER")) };
  return { sandbox: value("SANDBOX") as Env["sandbox"], phases, secrets, mountCodexLogin, repoPaths, kanban };
};
