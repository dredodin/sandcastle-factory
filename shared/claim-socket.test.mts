import { execFileSync, spawn } from "node:child_process";
import assert from "node:assert/strict";
import { test } from "node:test";
import { withClaim } from "./claim-socket.mjs";

const identity = (root: number) => ({ repo: "acme/home", root, startedAt: "now" });
const PORTS = [29270, 29271];

test("withClaim: a second run on the same root is refused, another root runs, the port is released after", async () => {
  await withClaim(PORTS, identity(1), async () => {
    await assert.rejects(withClaim(PORTS, identity(1), async () => "no"), /already live/);
    assert.equal(await withClaim(PORTS, identity(2), async () => "ok"), "ok");
  });
  assert.equal(await withClaim(PORTS, identity(1), async () => "again"), "again");
});

test("withClaim: the holder answers probes while the run blocks its event loop", async () => {
  const script = `fetch("http://127.0.0.1:${PORTS[0]}/").then((r) => r.json()).then((j) => console.log(JSON.stringify(j)))`;
  const answer = await withClaim(PORTS, identity(3), async () => {
    const child = spawn(process.execPath, ["-e", script]);
    const out = new Promise<string>((resolve) => {
      let text = "";
      child.stdout.on("data", (chunk: Buffer) => (text += chunk));
      child.on("close", () => resolve(text));
    });
    execFileSync("sleep", ["2"]);
    return out;
  });
  assert.equal(JSON.parse(answer).root, 3);
});
