// The thin I/O shell around `decision.mts`: probes the root's pipe and holds it for the run's life.

import { rmSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { Worker } from "node:worker_threads";
import { decideStart, identitySchema, pipePath, type Holder, type Identity } from "./decision.mjs";

const PROBE_MS = 3_000;
const ATTEMPTS = [1, 2, 3] as const;
// Connecting to a pipe nobody listens on: no pipe (Windows, or no file), or a socket file left by a killed process.
const NOBODY: ReadonlySet<string> = new Set(["ENOENT", "ECONNREFUSED"]);

const probe = (path: string): Promise<Holder> =>
  new Promise((resolve) => {
    const socket = connect(path);
    let text = "";
    socket.setTimeout(PROBE_MS, () => socket.destroy());
    socket.on("data", (chunk: Buffer) => (text += chunk));
    socket.on("error", (error: NodeJS.ErrnoException) => resolve(NOBODY.has(error.code ?? "") ? { kind: "none" } : { kind: "foreign", detail: error.code ?? error.message }));
    socket.on("close", () => {
      let answer: unknown = null;
      try {
        answer = JSON.parse(text);
      } catch {
        // Not JSON: not a factory.
      }
      const identity = identitySchema.safeParse(answer);
      resolve(identity.success ? { kind: "run", identity: identity.data } : { kind: "foreign", detail: text === "" ? "no answer" : "not a run identity" });
    });
  });

// What the holder thread tells the run.
type HolderMessage = { readonly type: "listening" } | { readonly type: "busy" } | { readonly type: "failed"; readonly message: string };

// The server lives in a worker thread, as plain JS because a worker needs a file or a string: the run shells out with blocking calls, and its own loop would not answer probes meanwhile.
const SERVER = `
const { workerData, parentPort } = require("node:worker_threads");
const { createServer } = require("node:net");
const server = createServer((socket) => socket.end(JSON.stringify(workerData.identity)));
server.once("error", (error) => parentPort.postMessage(error.code === "EADDRINUSE" ? { type: "busy" } : { type: "failed", message: error.message }));
server.listen(workerData.path, () => parentPort.postMessage({ type: "listening" }));
`;

// Resolves the holder, or null when the pipe was taken first; any other error is real.
const listen = (path: string, identity: Identity): Promise<Worker | null> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(SERVER, { eval: true, workerData: { path, identity } });
    worker.once("error", reject);
    worker.once("message", (message: HolderMessage) => {
      if (message.type === "listening") {
        worker.unref();
        resolve(worker);
        return;
      }
      void worker.terminate().then(() => (message.type === "busy" ? resolve(null) : reject(new Error(`cannot listen on ${path}: ${message.message}`))));
    });
  });

// Claims the root or throws naming why; runs `work` holding the pipe, releases it after.
export const withClaim = async <T,>(identity: Identity, work: () => Promise<T>): Promise<T> => {
  const path = pipePath(identity.repo, identity.root, process.platform, tmpdir());
  for (const _attempt of ATTEMPTS) {
    const held = await listen(path, identity);
    if (held === null) {
      // Taken: a live run refuses; a socket file left by a killed run is removed and listened on again.
      const claim = decideStart(await probe(path));
      if (claim.type === "refuse") throw new Error(claim.reason);
      if (process.platform !== "win32") rmSync(path, { force: true });
      continue;
    }
    try {
      return await work();
    } finally {
      await held.terminate();
    }
  }
  throw new Error(`the claim on ${identity.repo}#${identity.root} kept changing hands while starting; start again.`);
};
