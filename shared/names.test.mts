import assert from "node:assert/strict";
import { test } from "node:test";
import { deepVerifyCommand, imageName, logFileName, planCheckCommand, repoKey, repoNamesFromMap, slugFromRemote } from "./names.mjs";

test("repoNamesFromMap: names from .sandcastle/repos links, once each, in order", () => {
  const map = [
    "- [Web](./.sandcastle/repos/web/source/GLOSSARY.md) — the site",
    "- [Api](.sandcastle/repos/api/source/GLOSSARY.md) — the service",
    "- [Web again](<./.sandcastle/repos/web/source/docs/CONTEXT.md>)",
    "- [Shared](./GLOSSARY.md) — not a repo",
    "- [Elsewhere](./content/.sandcastle/repos/nope/x.md)",
  ].join("\n");
  assert.deepEqual(repoNamesFromMap(map), ["web", "api"]);
});

test("repoNamesFromMap: no links gives an empty list", () => {
  assert.deepEqual(repoNamesFromMap("# Glossary Map\n\n- [Shared](./GLOSSARY.md)"), []);
});

test("repoKey: upper case, non-alphanumerics become underscores", () => {
  assert.equal(repoKey("app"), "REPO_APP");
  assert.equal(repoKey("my-app.v2"), "REPO_MY_APP_V2");
});

test("deepVerifyCommand and planCheckCommand: scripts in the repo's folder", () => {
  assert.equal(deepVerifyCommand("app", "origin/main"), "bash .sandcastle/repos/app/deep-verify.sh origin/main");
  assert.equal(planCheckCommand("hub"), "bash .sandcastle/repos/hub/plan-check.sh");
});

test("slugFromRemote: https, ssh, with and without .git", () => {
  const slug = { owner: "acme", name: "hub" };
  assert.deepEqual(slugFromRemote("https://github.com/acme/hub.git"), slug);
  assert.deepEqual(slugFromRemote("https://github.com/acme/hub"), slug);
  assert.deepEqual(slugFromRemote("git@github.com:acme/hub.git\n"), slug);
  assert.deepEqual(slugFromRemote("ssh://git@github.com/acme/hub.git"), slug);
  assert.deepEqual(slugFromRemote("https://x-access-token:abc@github.com/acme/a.b"), { owner: "acme", name: "a.b" });
});

test("slugFromRemote: another host throws", () => {
  assert.throws(() => slugFromRemote("https://gitlab.com/acme/hub.git"), /GitHub/);
});

test("imageName: home and repo, lower case", () => {
  assert.equal(imageName("hub", "app"), "sandcastle:hub-app");
  assert.equal(imageName("Hub", "App"), "sandcastle:hub-app");
});

test("logFileName: suffix for app repos only", () => {
  assert.equal(logFileName("1-223-implement", "app", "hub"), "1-223-implement-app");
  assert.equal(logFileName("review", "app", "hub"), "review-app");
  assert.equal(logFileName("review", "hub", "hub"), "review");
});
