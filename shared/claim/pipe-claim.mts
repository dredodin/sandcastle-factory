// The thin I/O shell around `start-decision.mts`: listens on the root's named pipe and holds it for the run's life.
// No worker: the OS accepts a connection while the run's loop is blocked in `execFileSync`, so an accepted connection already proves a live run; the identity reply waits for the loop.

import { mkdirSync, rmSync, statSync } from "node:fs";
import { connect, createServer, type Server } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { message } from "../cli.mjs";
import { log } from "../logger.mjs";
import { decideStart, identitySchema, pipeName, POSIX_DIR, type Attempt, type Identity, type Peer } from "./start-decision.mjs";

const IDENTITY_MS = 2_000; // How long a refused run waits for the holder to say who it is.
const MAX_ATTEMPTS = 3;
const LOCK_WAIT_MS = 50;
const LOCK_TRIES = 200;
const LOCK_STALE_MS = 10_000; // A lock older than this was left by a killed process.

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
    let text = "";
    socket.setEncoding("utf8");
    const done = (peer: Peer): void => {
      socket.destroy();
      resolve(peer);
    };
    socket.setTimeout(IDENTITY_MS, () => done({ kind: "live", identity: null }));
    socket.on("data", (chunk: string) => (text += chunk));
    socket.on("end", () => done({ kind: "live", identity: parseIdentity(text) }));
    socket.on("error", (error) => {
      if (codeOf(error) === "ECONNREFUSED" || codeOf(error) === "ENOENT") done({ kind: "dead" });
      else reject(error);
    });
  });

const closed = (server: Server): Promise<void> => new Promise((resolve) => server.close(() => resolve()));

const named = (identity: Identity, error: unknown): Error => new Error(`cannot claim ${identity.repo}#${identity.root}: ${message(error)}`);

const staleLock = (lock: string): boolean => {
  try {
    return Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS;
  } catch {
    return false; // Released meanwhile.
  }
};

// Mutual exclusion among starting runs (not held while a run works): `mkdir` is atomic, so one waiter at a time clears a stale socket file.
const exclusively = async <T,>(lock: string, body: () => Promise<T>, triesLeft = LOCK_TRIES): Promise<T> => {
  try {
    mkdirSync(lock);
  } catch (error) {
    if (codeOf(error) !== "EEXIST") throw error;
    if (triesLeft <= 0) throw new Error(`the start lock ${lock} stays held; remove it if no run is starting.`);
    if (staleLock(lock)) rmSync(lock, { recursive: true, force: true });
    else await sleep(LOCK_WAIT_MS);
    return exclusively(lock, body, triesLeft - 1);
  }
  try {
    return await body();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
};

// The pipe directory must be ours and private: another user's directory could hold sockets that refuse every run.
const checkDir = (): void => {
  mkdirSync(POSIX_DIR, { recursive: true, mode: 0o700 });
  const { uid, mode } = statSync(POSIX_DIR);
  if (uid !== process.getuid?.()) throw new Error(`${POSIX_DIR} is owned by another user (uid ${uid}); remove it or fix its owner.`);
  if ((mode & 0o777) !== 0o700) throw new Error(`${POSIX_DIR} has mode ${(mode & 0o777).toString(8)}, not 700; chmod 700 it.`);
};

// Listens, or clears a dead socket file and listens again; the server it returns is the hold.
const claimFrom = async (path: string, identity: Identity, attemptsLeft: number): Promise<Server> => {
  const server = await listen(path, identity).catch((error: unknown) => Promise.reject(named(identity, error)));
  const attempt: Attempt<Server> =
    server === null ? { kind: "taken", peer: await probe(path).catch((error: unknown) => Promise.reject(named(identity, error))) } : { kind: "listening", holder: server };
  const start = decideStart(attempt, identity);
  if (start.type === "refuse") throw new Error(start.reason);
  if (start.type === "hold") return start.holder;
  if (attemptsLeft <= 1) throw new Error(`the claim on ${identity.repo}#${identity.root} kept changing hands; start again.`);
  rmSync(path, { force: true }); // clear-stale: a socket file a dead process left.
  return claimFrom(path, identity, attemptsLeft - 1);
};

// Claims the root or throws naming why; runs `work` holding the pipe, releases it after.
export const withClaim = async <T,>(identity: Identity, work: () => Promise<T>): Promise<T> => {
  const windows = process.platform === "win32";
  const path = pipeName(identity.repo, identity.root, windows ? "windows" : "posix");
  if (!windows) {
    try {
      checkDir();
    } catch (error) {
      throw named(identity, error);
    }
  }
  const claim = (): Promise<Server> => claimFrom(path, identity, MAX_ATTEMPTS);
  const server = await (windows ? claim() : exclusively(`${path}.lock`, claim));
  try {
    return await work();
  } finally {
    await closed(server);
  }
};
