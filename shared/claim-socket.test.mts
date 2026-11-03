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
