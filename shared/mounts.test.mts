import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMounts } from "./mounts.mjs";

test("parseMounts: skips blanks and comments, read-only by default, CRLF tolerated", () => {
  const text = "# packages\r\n\r\n~/.nuget/packages -> /home/agent/nuget-packages\r\n  # more\r\n";
  assert.deepEqual(parseMounts(text, "mounts"), [{ hostPath: "~/.nuget/packages", sandboxPath: "/home/agent/nuget-packages", readonly: true }]);
});

test("parseMounts: Windows host paths keep their colon and spaces", () => {
  const [mount] = parseMounts("C:\\Users\\Jo Doe\\.nuget\\packages -> /home/agent/p", "mounts");
  assert.equal(mount?.hostPath, "C:\\Users\\Jo Doe\\.nuget\\packages");
  assert.equal(mount?.sandboxPath, "/home/agent/p");
});

test("parseMounts: a line without the separator names the file and the line number", () => {
  assert.throws(() => parseMounts("# c\n\n~/a -> /b\n~/x:/y\n", "repos/web/mounts"), /repos\/web\/mounts:4:/);
});

test("parseMounts: an empty side is an error", () => {
  assert.throws(() => parseMounts(" -> /b", "mounts"), /mounts:1:/);
  assert.throws(() => parseMounts("~/a -> ", "mounts"), /mounts:1:/);
});

test("parseMounts: extra spaces around the separator are not part of the paths", () => {
  assert.deepEqual(parseMounts("~/a   ->   /b", "mounts"), [{ hostPath: "~/a", sandboxPath: "/b", readonly: true }]);
});

test("parseMounts: a line ending in (rw) is writable and keeps its paths clean", () => {
  assert.deepEqual(parseMounts("~/a -> /b (rw)\r\n~/c -> /d", "mounts"), [
    { hostPath: "~/a", sandboxPath: "/b", readonly: false },
    { hostPath: "~/c", sandboxPath: "/d", readonly: true },
  ]);
});

test("parseMounts: (rw) in place of a sandbox path is an error", () => {
  assert.throws(() => parseMounts("~/a -> (rw)", "mounts"), /mounts:1:/);
  assert.throws(() => parseMounts("~/a ->  (rw)", "mounts"), /mounts:1:/);
});
