import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { test } from "node:test";
import { pipePath } from "./decision.mjs";
import { withClaim } from "./pipe.mjs";

const REPO = `acme/pipe-test-${process.pid}`;
const identity = (root: number) => ({ repo: REPO, root, startedAt: "now" });

test("withClaim: a second run on the same root is refused, another root runs, the pipe is released after", async () => {
  await withClaim(identity(1), async () => {
    await assert.rejects(withClaim(identity(1), async () => "no"), /already live/);
    assert.equal(await withClaim(identity(2), async () => "ok"), "ok");
  });
  assert.equal(await withClaim(identity(1), async () => "again"), "again");
});

test("withClaim: the holder answers probes while the run blocks its event loop", async () => {
  const path = pipePath(REPO, 3, process.platform, tmpdir());
  const script = `require("node:net").connect(${JSON.stringify(path)}).on("data", (chunk) => process.stdout.write(chunk))`;
  const answer = await withClaim(identity(3), async () => {
    const child = spawn(process.execPath, ["-e", script]);
    const out = new Promise<string>((resolve) => {
      let text = "";
      child.stdout.on("data", (chunk: Buffer) => (text += chunk));
      child.on("close", () => resolve(text));
    });
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2_000);
    return out;
  });
  assert.equal(JSON.parse(answer).root, 3);
});
