// The thin I/O shell around `start-decision.mts`: listens on the root's named pipe and holds it for the run's life.
// No worker: the OS accepts a connection while the run's loop is blocked in `execFileSync`, so an accepted connection already proves a live run; the identity reply waits for the loop.

import { rmSync, mkdirSync } from "node:fs";
import { connect, createServer, type Server } from "node:net";
import { log } from "../logger.mjs";
import { decideStart, identitySchema, pipeName, POSIX_DIR, type Identity, type Peer } from "./start-decision.mjs";

const IDENTITY_MS = 2_000; // How long a refused run waits for the holder to say who it is.
const MAX_ATTEMPTS = 3;

const codeOf = (error: unknown): unknown => (error instanceof Error && "code" in error ? error.code : undefined);

const parseIdentity = (text: string): Identity | null => {
  try {
    const parsed = identitySchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

// Resolves the holder, or null when the name is taken; any other error is real.
const listen = (path: string, identity: Identity): Promise<Server | null> =>
  new Promise((resolve, reject) => {
    const server = createServer((socket) => {
      socket.on("error", () => undefined); // A prober hanging up early is no failure of this run.
      socket.end(JSON.stringify(identity));
    });
    const onBindError = (error: Error): void => (codeOf(error) === "EADDRINUSE" ? resolve(null) : reject(error));
    server.once("error", onBindError);
    server.listen(path, () => {
      server.off("error", onBindError);
      server.on("error", (error) => log.error(`the claim on ${identity.repo}#${identity.root} failed mid-run, a second run can now start on it: ${error.message}`));
      resolve(server);
    });
  });

// A refused connection or a missing socket file means nobody holds the name; an accepted one means a live run.
const probe = (path: string): Promise<Peer> =>
  new Promise((resolve, reject) => {
    const socket = connect(path);
    const chunks: Buffer[] = [];
    const done = (peer: Peer): void => {
      socket.destroy();
      resolve(peer);
    };
    socket.setTimeout(IDENTITY_MS, () => done({ kind: "live", identity: null }));
    socket.on("data", (chunk: Buffer) => chunks.push(chunk));
    socket.on("end", () => done({ kind: "live", identity: parseIdentity(Buffer.concat(chunks).toString()) }));
    socket.on("error", (error) => {
      if (codeOf(error) === "ECONNREFUSED" || codeOf(error) === "ENOENT") done({ kind: "dead" });
      else reject(error);
    });
  });

const closed = (server: Server): Promise<void> => new Promise((resolve) => server.close(() => resolve()));

const named = (identity: Identity, error: unknown): Error => new Error(`cannot claim ${identity.repo}#${identity.root}: ${error instanceof Error ? error.message : String(error)}`);

// Claims the root or throws naming why; runs `work` holding the pipe, releases it after.
export const withClaim = async <T,>(identity: Identity, work: () => Promise<T>): Promise<T> => {
  const windows = process.platform === "win32";
  const path = pipeName(identity.repo, identity.root, windows ? "windows" : "posix");
  try {
    if (!windows) mkdirSync(POSIX_DIR, { recursive: true, mode: 0o700 });
  } catch (error) {
    throw named(identity, error);
  }
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const server = await listen(path, identity).catch((error: unknown) => Promise.reject(named(identity, error)));
    const start = decideStart(server === null ? { kind: "taken", peer: await probe(path).catch((error: unknown) => Promise.reject(named(identity, error))) } : { kind: "listening" }, identity);
    if (start.type === "refuse") throw new Error(start.reason);
    if (start.type === "hold" && server !== null) {
      try {
        return await work();
      } finally {
        await closed(server);
      }
    }
    rmSync(path, { force: true }); // clear-stale: a socket file a dead process left.
  }
  throw new Error(`the claim on ${identity.repo}#${identity.root} kept changing hands; start again.`);
};
