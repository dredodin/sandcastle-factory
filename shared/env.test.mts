import assert from "node:assert/strict";
import { test } from "node:test";
import { missingKeys, upsertEnvLine } from "./env.mjs";

const phases = (provider: string): Record<string, string> =>
  Object.fromEntries(["PLAN", "IMPLEMENT", "REVIEW", "MERGE", "PR"].flatMap((p) => [[`${p}_PROVIDER`, provider], [`${p}_MODEL`, "m"], [`${p}_EFFORT`, "high"]]));

test("missingKeys: empty file asks for the base keys and the phase keys, in order", () => {
  assert.deepEqual(missingKeys({}, []).slice(0, 5), ["GH_TOKEN", "SANDBOX", "PLAN_PROVIDER", "PLAN_MODEL", "PLAN_EFFORT"]);
});

test("missingKeys: claudeCode phases need one Claude credential, either one", () => {
  const base = { GH_TOKEN: "t", SANDBOX: "none", ...phases("claudeCode") };
  assert.deepEqual(missingKeys(base, []), ["CLAUDE_CODE_OAUTH_TOKEN"]);
  assert.deepEqual(missingKeys({ ...base, ANTHROPIC_API_KEY: "k" }, []), []);
  assert.deepEqual(missingKeys({ ...base, CLAUDE_CODE_OAUTH_TOKEN: "k" }, []), []);
});

test("missingKeys: copilot token only when a phase uses copilot", () => {
  const base = { GH_TOKEN: "t", SANDBOX: "none", ...phases("claudeCode"), ANTHROPIC_API_KEY: "k" };
  assert.deepEqual(missingKeys(base, []), []);
  assert.deepEqual(missingKeys({ ...base, PR_PROVIDER: "copilot" }, []), ["COPILOT_GITHUB_TOKEN"]);
});

test("missingKeys: a repo path per non-home repo, blank counts as missing", () => {
  const base = { GH_TOKEN: "t", SANDBOX: "podman", ...phases("copilot"), COPILOT_GITHUB_TOKEN: "c", REPO_WEB: "" };
  assert.deepEqual(missingKeys(base, ["web", "my-api"]), ["REPO_WEB", "REPO_MY_API"]);
});

test("upsertEnvLine: appends a new key after a final newline", () => {
  assert.equal(upsertEnvLine("A=1\n", "B", "2"), "A=1\nB=2\n");
  assert.equal(upsertEnvLine("A=1", "B", "2"), "A=1\nB=2\n");
  assert.equal(upsertEnvLine("", "B", "2"), "B=2\n");
});

test("upsertEnvLine: replaces the key's line in place, touching nothing else", () => {
  assert.equal(upsertEnvLine("# note\nB=\nC=3\n", "B", "2"), "# note\nB=2\nC=3\n");
  assert.equal(upsertEnvLine("A=1\nAB=5\n", "A", "9"), "A=9\nAB=5\n");
});

test("upsertEnvLine: every line of a repeated key is replaced", () => {
  assert.equal(upsertEnvLine("A=1\nB=2\nA=3\n", "A", "9"), "A=9\nB=2\nA=9\n");
});

test("upsertEnvLine: a value with spaces, a hash or a backslash is single-quoted, one with a single quote back-quoted", () => {
  assert.equal(upsertEnvLine("", "REPO_X", "C:/my repos/x"), "REPO_X='C:/my repos/x'\n");
  assert.equal(upsertEnvLine("", "K", "a\\nb#c"), "K='a\\nb#c'\n");
  assert.equal(upsertEnvLine("", "K", "it's"), "K=`it's`\n");
});

test("upsertEnvLine: a value no quote can hold throws", () => {
  assert.throws(() => upsertEnvLine("", "K", "'`"), /K/);
});
