// `.sandcastle/.env` in the home repo: the one per-machine file. Checked by a schema the factory owns.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv as parseDotenv } from "node:util";
import { z } from "zod";
import { repoKey } from "./names.mjs";

export const PHASES = ["PLAN", "IMPLEMENT", "REVIEW", "MERGE", "PR"] as const;
export type Phase = (typeof PHASES)[number];
const PROVIDERS = ["claudeCode", "copilot"] as const;
const SANDBOXES = ["docker", "podman", "none"] as const;
export type PhaseSetting = { readonly provider: (typeof PROVIDERS)[number]; readonly model: string; readonly effort: string };
export type Values = Readonly<Record<string, string>>;

export type Env = {
  readonly sandbox: (typeof SANDBOXES)[number];
  readonly phases: Readonly<Record<Phase, PhaseSetting>>;
  // The tokens the sandbox and the agents get, by name.
  readonly secrets: Values;
  // Local path of every repo that is not the home repo, by repo name.
  readonly repoPaths: Values;
};

const CLAUDE_AUTH = ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY"] as const;
const COPILOT_TOKEN = "COPILOT_GITHUB_TOKEN";
const SECRET_KEYS = ["GH_TOKEN", ...CLAUDE_AUTH, COPILOT_TOKEN] as const;

const phaseKeys = (phase: Phase): readonly string[] => [`${phase}_PROVIDER`, `${phase}_MODEL`, `${phase}_EFFORT`];

const has = (values: Values, key: string): boolean => (values[key] ?? "") !== "";

// Every key the machine needs, in the order `setup` asks for them, given the values so far.
// Provider-dependent keys appear once the providers are known.
export const requiredKeys = (values: Values, repoNames: readonly string[]): readonly string[] => {
  const providers = PHASES.map((phase) => values[`${phase}_PROVIDER`]);
  const claudeAuth = CLAUDE_AUTH.find((key) => has(values, key)) ?? CLAUDE_AUTH[0];
  return [
    "GH_TOKEN",
    "SANDBOX",
    ...PHASES.flatMap(phaseKeys),
    ...(providers.includes("claudeCode") ? [claudeAuth] : []),
    ...(providers.includes("copilot") ? [COPILOT_TOKEN] : []),
    ...repoNames.map(repoKey),
  ];
};

export const missingKeys = (values: Values, repoNames: readonly string[]): readonly string[] =>
  requiredKeys(values, repoNames).filter((key) => !has(values, key));

// Quotes Node's env parser reads literally; double quotes would expand `\n` and cannot escape a `"`.
const LITERAL_QUOTES = ["'", "`"] as const;

const quoted = (key: string, value: string): string => {
  if (!/[\s#"'`\\]/.test(value)) return value;
  const quote = LITERAL_QUOTES.find((candidate) => !value.includes(candidate));
  if (quote === undefined || value.includes("\n")) throw new Error(`${key}: a value with both ' and \` or a line break cannot be written.`);
  return `${quote}${value}${quote}`;
};

// Replaces every `KEY=` line (the parser reads the last), or appends one; every other line stays as it is.
export const upsertEnvLine = (text: string, key: string, value: string): string => {
  const line = `${key}=${quoted(key, value)}`;
  const lines = text.split("\n");
  if (lines.some((existing) => existing.startsWith(`${key}=`))) return lines.map((existing) => (existing.startsWith(`${key}=`) ? line : existing)).join("\n");
  return `${text}${text === "" || text.endsWith("\n") ? "" : "\n"}${line}\n`;
};

const envPath = (root: string): string => `${root}/.sandcastle/.env`;

// The non-blank values of `.env`; nothing comes from the shell environment.
export const readValues = (root: string): Values => {
  const file = existsSync(envPath(root)) ? parseDotenv(readFileSync(envPath(root), "utf8")) : {};
  return Object.fromEntries(Object.entries(file).filter((entry): entry is [string, string] => (entry[1] ?? "") !== ""));
};

export const writeValue = (root: string, key: string, value: string): void => {
  const path = envPath(root);
  writeFileSync(path, upsertEnvLine(existsSync(path) ? readFileSync(path, "utf8") : "", key, value));
};

const nonEmpty = z.string().min(1);

const schemaFor = (repoNames: readonly string[]): z.ZodType<Record<string, string | undefined>> =>
  z
    .object({
      GH_TOKEN: nonEmpty,
      SANDBOX: z.enum(SANDBOXES),
      CLAUDE_CODE_OAUTH_TOKEN: nonEmpty.optional(),
      ANTHROPIC_API_KEY: nonEmpty.optional(),
      COPILOT_GITHUB_TOKEN: nonEmpty.optional(),
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
    }) as z.ZodType<Record<string, string | undefined>>;

// The checked environment; throws naming every missing or invalid key. `repoNames` are the repos other than the home repo.
export const checkEnv = (values: Values, repoNames: readonly string[]): Env => {
  const parsed = schemaFor(repoNames).safeParse(values);
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
  return { sandbox: value("SANDBOX") as Env["sandbox"], phases, secrets, repoPaths };
};
