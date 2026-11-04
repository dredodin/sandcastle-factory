// The thin I/O shell around `start-decision.mts`: listens on the root's named pipe and holds it for the run's life.
// No worker: the OS accepts a connection while the run's loop is blocked in `execFileSync`, so an accepted connection already proves a live run; the identity reply waits for the loop.

import { mkdirSync, rmSync } from "node:fs";
import { connect, createServer, type Server } from "node:net";
import { text } from "node:stream/consumers";
import { message } from "../cli.mjs";
import { log } from "../logger.mjs";
import { decideStart, identitySchema, pipeName, POSIX_DIR, type Attempt, type Identity, type Peer } from "./start-decision.mjs";

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
    socket.setEncoding("utf8");
    const done = (peer: Peer): void => {
      socket.destroy();
      resolve(peer);
    };
    socket.setTimeout(IDENTITY_MS, () => done({ kind: "live", identity: null }));
    text(socket).then((reply) => done({ kind: "live", identity: parseIdentity(reply) }), () => undefined); // Socket errors are handled below.
    socket.on("error", (error) => {
      if (codeOf(error) === "ECONNREFUSED" || codeOf(error) === "ENOENT") done({ kind: "dead" });
      else reject(error);
    });
  });

const closed = (server: Server): Promise<void> => new Promise((resolve) => server.close(() => resolve()));

const named = (identity: Identity, error: unknown): Error => new Error(`cannot claim ${identity.repo}#${identity.root}: ${message(error)}`);

// Listens, or clears a dead socket file and listens again; the server it returns is the hold.
const claimFrom = async (path: string, identity: Identity, attemptsLeft: number): Promise<Server> => {
  const server = await listen(path, identity).catch((error: unknown) => Promise.reject(named(identity, error)));
  const attempt: Attempt<Server> =
    server === null ? { kind: "taken", peer: await probe(path).catch((error: unknown) => Promise.reject(named(identity, error))) } : { kind: "listening", holder: server };
  const start = decideStart(attempt, identity);
  if (start.type === "refuse") throw new Error(start.reason);
  if (start.type === "hold") return start.holder;
  if (attemptsLeft <= 1) throw new Error(`the claim on ${identity.repo}#${identity.root} kept changing hands; start again.`);
  if (process.platform !== "win32") {
    try {
      rmSync(path, { force: true }); // clear-stale: a socket file a dead process left.
    } catch (error) {
      throw named(identity, error);
    }
  } // A Windows pipe has no file: the holder is gone, just listen again.
  return claimFrom(path, identity, attemptsLeft - 1);
};

// Claims the root or throws naming why; runs `work` holding the pipe, releases it after.
export const withClaim = async <T,>(identity: Identity, work: () => Promise<T>): Promise<T> => {
  const windows = process.platform === "win32";
  const path = pipeName(identity.repo, identity.root, windows ? "windows" : "posix");
  if (!windows) {
    try {
      mkdirSync(POSIX_DIR, { recursive: true });
    } catch (error) {
      throw named(identity, error);
    }
  }
  const server = await claimFrom(path, identity, MAX_ATTEMPTS);
  try {
    return await work();
  } finally {
    await closed(server);
  }
};
