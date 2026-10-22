import assert from "node:assert/strict";
import { test } from "node:test";
import { configBlock } from "./config-block.mjs";

test("configBlock: run lines, then the phase table padded to its widest cells", () => {
  const block = configBlock({
    mode: "take",
    root: 42,
    title: "Fix it",
    branch: "sandcastle/hub/issue-42-take-1",
    logDir: "/logs/issue-42-take-1",
    repos: ["acme/hub", "acme/app"],
    sandbox: "podman",
    settings: [
      { phase: "PLAN", provider: "claudeCode", model: "opus", effort: "high" },
      { phase: "IMPLEMENT", provider: "copilot", model: "gpt", effort: "medium" },
    ],
    maxCycles: 5,
  });
  assert.equal(
    block,
    [
      "take #42 — Fix it",
      "branch: sandcastle/hub/issue-42-take-1",
      "repos: acme/hub, acme/app",
      "sandbox: podman",
      "log folder: /logs/issue-42-take-1",
      "phase      provider    model  effort",
      "PLAN       claudeCode  opus   high",
      "IMPLEMENT  copilot     gpt    medium",
      "cycle cap: 5",
    ].join("\n"),
  );
});
