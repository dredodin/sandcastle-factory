import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { test } from "node:test";
import { withClaim } from "./pipe-claim.mjs";
import { pipeName } from "./start-decision.mjs";

const identity = (root: number) => ({ repo: `acme/pipe-test-${process.pid}`, root, startedAt: "now" });
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
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2_000);
    return { accepted: Number(await out), blockedUntil: Date.now() };
  });
  assert.ok(accepted < blockedUntil - 1_000);
});

test("withClaim: a socket file left by a killed process is cleared, no flag", { skip: !posix }, async () => {
  const script = `require("node:net").createServer().listen(${JSON.stringify(pathOf(4))}, () => console.log("up"))`;
  const child = spawn(process.execPath, ["-e", script]);
  await new Promise((resolve) => child.stdout.once("data", resolve));
  child.kill("SIGKILL");
  await new Promise((resolve) => child.once("close", resolve));
  assert.equal(await withClaim(identity(4), async () => "resumed"), "resumed");
});
