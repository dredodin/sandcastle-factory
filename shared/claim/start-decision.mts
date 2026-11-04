// A run claims its root through a named pipe per root ([ADR-0009](../../docs/adr/0009-a-run-claims-its-root-through-a-named-pipe.md)). Pure decisions: no sockets.

import { z } from "zod";

// What a live run answers on its pipe.
export const identitySchema = z.object({ repo: z.string(), root: z.number(), startedAt: z.string() });
export type Identity = z.infer<typeof identitySchema>;

export type Platform = "windows" | "posix";

export const POSIX_DIR = "/tmp/sandcastle-factory";
const WINDOWS_PREFIX = String.raw`\\.\pipe\sandcastle-factory-`;
// Below the 104-char socket path limit of macOS (Linux: 108).
const MAX_POSIX_PATH = 100;

// The exact pipe of a root. `@` is in no owner or repo name, so two roots never share a name.
export const pipeName = (repo: string, root: number, platform: Platform): string => {
  const name = `${repo.replace("/", "@")}@${root}`;
  if (platform === "windows") return `${WINDOWS_PREFIX}${name}`;
  const path = `${POSIX_DIR}/${name}.sock`;
  if (path.length > MAX_POSIX_PATH) throw new Error(`the socket path for ${repo}#${root} is longer than ${MAX_POSIX_PATH} characters: ${path}`);
  return path;
};

// Who holds a taken pipe: a connection was accepted (`identity` only when it answered in time), or nobody (a socket file a dead process left).
export type Peer = { readonly kind: "live"; readonly identity: Identity | null } | { readonly kind: "dead" };

// The result of trying to listen on the pipe.
export type Attempt = { readonly kind: "listening" } | { readonly kind: "taken"; readonly peer: Peer };

export type Start = { readonly type: "hold" } | { readonly type: "clear-stale" } | { readonly type: "refuse"; readonly reason: string };

// Before any card moves: hold the pipe, clear a dead socket file and listen again, or refuse naming the live run.
export const decideStart = (attempt: Attempt, own: Identity): Start => {
  if (attempt.kind === "listening") return { type: "hold" };
  if (attempt.peer.kind === "dead") return { type: "clear-stale" };
  const since = attempt.peer.identity === null ? "" : `, started ${attempt.peer.identity.startedAt}`;
  return { type: "refuse", reason: `a run is already live on ${own.repo}#${own.root}${since}.` };
};
