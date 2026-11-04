import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { test } from "node:test";
import { withClaim } from "./pipe-claim.mjs";
import { chmodSync, statSync } from "node:fs";
import { pipeName, POSIX_DIR } from "./start-decision.mjs";

const identity = (root: number) => ({ repo: `acme/pipe-test-${process.pid}`, root, startedAt: "now" });
const BLOCK_MS = 5_000; // The child has half of it to start and connect.
const posix = process.platform !== "win32";
const pathOf = (root: number) => pipeName(identity(root).repo, root, posix ? "posix" : "windows");

test("withClaim: a second run on the same root is refused, another root runs, the pipe is released after", async () => {
  await withClaim(identity(1), async () => {
    await assert.rejects(withClaim(identity(1), async () => "no"), /already live.*started now/);
    assert.equal(await withClaim(identity(2), async () => "ok"), "ok");
  });
  assert.equal(await withClaim(identity(1), async () => "again"), "again");
});

test("withClaim: the pipe accepts a connection while the run blocks its event loop", async () => {
  const script = `require("node:net").connect(${JSON.stringify(pathOf(3))}).on("connect", () => { console.log(Date.now()); process.exit(); })`;
  const { accepted, blockedUntil } = await withClaim(identity(3), async () => {
    const child = spawn(process.execPath, ["-e", script]);
    const out = new Promise<string>((resolve) => {
      let text = "";
      child.stdout.on("data", (chunk: Buffer) => (text += chunk));
      child.on("close", () => resolve(text));
    });
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, BLOCK_MS);
    return { accepted: Number(await out), blockedUntil: Date.now() };
  });
  assert.ok(accepted < blockedUntil - BLOCK_MS / 2);
});

test("withClaim: a socket file left by a killed process is cleared, no flag", { skip: !posix }, async () => {
  const script = `require("node:net").createServer().listen(${JSON.stringify(pathOf(4))}, () => console.log("up"))`;
  const child = spawn(process.execPath, ["-e", script]);
  await new Promise((resolve) => child.stdout.once("data", resolve));
  child.kill("SIGKILL");
  await new Promise((resolve) => child.once("close", resolve));
  assert.equal(await withClaim(identity(4), async () => "resumed"), "resumed");
});

test("withClaim: two runs starting on a dead socket file leave exactly one holder", { skip: !posix }, async () => {
  const script = `require("node:net").createServer().listen(${JSON.stringify(pathOf(5))}, () => console.log("up"))`;
  const child = spawn(process.execPath, ["-e", script]);
  await new Promise((resolve) => child.stdout.once("data", resolve));
  child.kill("SIGKILL");
  await new Promise((resolve) => child.once("close", resolve));
  const runs = await Promise.allSettled([1, 2, 3, 4].map(() => withClaim(identity(5), () => new Promise((resolve) => setTimeout(resolve, 300)))));
  assert.equal(runs.filter((run) => run.status === "fulfilled").length, 1);
});

test("withClaim: a pipe directory with another mode is refused, named", { skip: !posix }, async () => {
  const { mode } = statSync(POSIX_DIR);
  chmodSync(POSIX_DIR, 0o755);
  try {
    await assert.rejects(withClaim(identity(6), async () => "no"), /has mode 755, not 700/);
  } finally {
    chmodSync(POSIX_DIR, mode & 0o777);
  }
});
