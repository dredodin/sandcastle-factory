// A run claims its root through a named pipe per root ([ADR-0009](../../docs/adr/0009-a-run-claims-its-root-through-a-named-pipe.md)). Pure decisions: no I/O.

import { z } from "zod";

// What a live run answers on its pipe. Extensible: unknown fields are stripped, later fields are optional.
export const identitySchema = z.object({ repo: z.string(), root: z.number(), startedAt: z.string() });
export type Identity = z.infer<typeof identitySchema>;

// Who holds the root's pipe when probed: nobody, a live factory run, or a program that does not answer as one.
export type Holder = { readonly kind: "none" } | { readonly kind: "foreign"; readonly detail: string } | { readonly kind: "run"; readonly identity: Identity };

export type Claim = { readonly type: "start" } | { readonly type: "refuse"; readonly reason: string };

// Before any card moves: start only when nobody holds the pipe.
export const decideStart = (holder: Holder): Claim => {
  if (holder.kind === "none") return { type: "start" };
  if (holder.kind === "foreign") return { type: "refuse", reason: `the pipe of this root is held by a program that is not a factory run (${holder.detail}).` };
  const { repo, root, startedAt } = holder.identity;
  return { type: "refuse", reason: `a run is already live on ${repo}#${root}, started ${startedAt}.` };
};

// Windows pipes live in `\\.\pipe\`; elsewhere the pipe is a socket file in `tmp`. The repo slug is encoded so two repos never share a name.
export const pipePath = (repo: string, root: number, platform: NodeJS.Platform, tmp: string): string => {
  const name = `sandcastle-factory-${encodeURIComponent(repo)}-${root}`;
  return platform === "win32" ? `\\\\.\\pipe\\${name}` : `${tmp}/${name}.sock`;
};
