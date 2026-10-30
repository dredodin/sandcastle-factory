import assert from "node:assert/strict";
import { test } from "node:test";
import { checkEnv, missingKeys, withShellOverrides } from "./env.mjs";

const phases = (provider: string): Record<string, string> =>
  Object.fromEntries(["PLAN", "IMPLEMENT", "REVIEW", "MERGE", "PR"].flatMap((p) => [[`${p}_PROVIDER`, provider], [`${p}_MODEL`, "m"], [`${p}_EFFORT`, "high"]]));

test("missingKeys: empty file asks for the base keys and the phase keys, in order", () => {
  assert.deepEqual(missingKeys({}, [], false).slice(0, 5), ["GH_TOKEN", "SANDBOX", "PLAN_PROVIDER", "PLAN_MODEL", "PLAN_EFFORT"]);
});

test("missingKeys: claudeCode phases need one Claude credential, either one", () => {
  const base = { GH_TOKEN: "t", SANDBOX: "none", ...phases("claudeCode") };
  assert.deepEqual(missingKeys(base, [], false), ["CLAUDE_CODE_OAUTH_TOKEN"]);
  assert.deepEqual(missingKeys({ ...base, ANTHROPIC_API_KEY: "k" }, [], false), []);
  assert.deepEqual(missingKeys({ ...base, CLAUDE_CODE_OAUTH_TOKEN: "k" }, [], false), []);
});

test("missingKeys: copilot token only when a phase uses copilot", () => {
  const base = { GH_TOKEN: "t", SANDBOX: "none", ...phases("claudeCode"), ANTHROPIC_API_KEY: "k" };
  assert.deepEqual(missingKeys(base, [], false), []);
  assert.deepEqual(missingKeys({ ...base, PR_PROVIDER: "copilot" }, [], false), ["COPILOT_GITHUB_TOKEN"]);
});

test("missingKeys: a repo path per non-home repo, blank counts as missing", () => {
  const base = { GH_TOKEN: "t", SANDBOX: "podman", ...phases("copilot"), COPILOT_GITHUB_TOKEN: "c", REPO_WEB: "" };
  assert.deepEqual(missingKeys(base, ["web", "my-api"], false), ["REPO_WEB", "REPO_MY_API"]);
});

test("withShellOverrides: a non-empty shell value of a known key wins over .env", () => {
  assert.deepEqual(withShellOverrides({ PLAN_MODEL: "opus", GH_TOKEN: "t" }, { PLAN_MODEL: "sonnet" }, []), { PLAN_MODEL: "sonnet", GH_TOKEN: "t" });
  assert.deepEqual(withShellOverrides({}, { ANTHROPIC_API_KEY: "k", COPILOT_GITHUB_TOKEN: "c" }, []), { ANTHROPIC_API_KEY: "k", COPILOT_GITHUB_TOKEN: "c" });
});

test("withShellOverrides: unknown shell variables are ignored", () => {
  assert.deepEqual(withShellOverrides({ SANDBOX: "none" }, { PATH: "/bin", HOME: "/h", REPO_OTHER: "/x" }, ["web"]), { SANDBOX: "none" });
});

test("withShellOverrides: an empty or unset shell value keeps the .env value", () => {
  assert.deepEqual(withShellOverrides({ PLAN_MODEL: "opus", SANDBOX: "podman" }, { PLAN_MODEL: "", SANDBOX: undefined }, []), { PLAN_MODEL: "opus", SANDBOX: "podman" });
});

test("withShellOverrides: the REPO_ key of a listed repo is honoured", () => {
  assert.deepEqual(withShellOverrides({ REPO_MY_API: "/a" }, { REPO_MY_API: "/b" }, ["my-api"]), { REPO_MY_API: "/b" });
});

const codexBase = { GH_TOKEN: "t", SANDBOX: "podman", ...phases("claudeCode"), ANTHROPIC_API_KEY: "k", IMPLEMENT_PROVIDER: "codex" };

test("checkEnv: codex phase with neither key nor host login fails naming CODEX_API_KEY", () => {
  assert.deepEqual(missingKeys(codexBase, [], false), ["CODEX_API_KEY"]);
  assert.throws(() => checkEnv(codexBase, [], false), /CODEX_API_KEY.*run codex login or set CODEX_API_KEY/);
});

test("checkEnv: codex phase passes with the key alone or the host login alone", () => {
  assert.deepEqual(missingKeys({ ...codexBase, CODEX_API_KEY: "k" }, [], false), []);
  assert.equal(checkEnv({ ...codexBase, CODEX_API_KEY: "k" }, [], false).secrets["CODEX_API_KEY"], "k");
  assert.deepEqual(missingKeys(codexBase, [], true), []);
  assert.doesNotThrow(() => checkEnv(codexBase, [], true));
});

test("checkEnv: no codex phase: no Codex requirement and no login mount", () => {
  const base = { ...codexBase, IMPLEMENT_PROVIDER: "claudeCode" };
  assert.deepEqual(missingKeys(base, [], false), []);
  assert.equal(checkEnv(base, [], true).mountCodexLogin, false);
});

test("checkEnv: the host login is mounted only when a phase uses codex and no key is set", () => {
  assert.equal(checkEnv(codexBase, [], true).mountCodexLogin, true);
  assert.equal(checkEnv({ ...codexBase, CODEX_API_KEY: "k" }, [], true).mountCodexLogin, false);
});

test("withShellOverrides: CODEX_API_KEY is a known key", () => {
  assert.deepEqual(withShellOverrides({}, { CODEX_API_KEY: "k" }, []), { CODEX_API_KEY: "k" });
});
