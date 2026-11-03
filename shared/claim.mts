// A run claims its root through a local port pool ([ADR-0009](../docs/adr/0009-a-run-claims-its-root-through-a-local-port-pool.md)). Pure decisions: no sockets.

import { z } from "zod";

// What a live run answers on its port. Extensible: unknown fields are stripped, later fields are optional.
export const identitySchema = z.object({ repo: z.string(), root: z.number(), startedAt: z.string() });
export type Identity = z.infer<typeof identitySchema>;

// What one pool port showed when probed: free, a live factory run, or something else holding it.
export type Probe = { readonly port: number } & ({ readonly kind: "free" } | { readonly kind: "foreign" } | { readonly kind: "run"; readonly identity: Identity });

export type Claim = { readonly type: "start"; readonly port: number } | { readonly type: "refuse"; readonly reason: string };

export const DEFAULT_PORTS = "29170-29179";

// The pool from a setting: comma-separated ports and `a-b` ranges.
export const parsePorts = (setting: string): readonly number[] => {
  const ports = setting.split(",").flatMap((part) => {
    const ends = part.split("-").map((text) => (/^[0-9]+$/.test(text.trim()) ? Number(text) : NaN));
    const [from = NaN, to = from] = ends;
    if (ends.length > 2 || Number.isNaN(from) || Number.isNaN(to) || to < from) throw new Error(`"${part.trim()}" is no port or port range`);
    return Array.from({ length: to - from + 1 }, (_, index) => from + index);
  });
  if (ports.some((port) => port < 1 || port > 65535)) throw new Error("a port is outside 1-65535");
  return [...new Set(ports)];
};

const describe = (probe: Probe): string => (probe.kind === "run" ? `${probe.identity.repo}#${probe.identity.root} since ${probe.identity.startedAt} on port ${probe.port}` : `port ${probe.port} is held by another program`);

const sameRoot = (probe: Probe, own: Identity): probe is Probe & { readonly kind: "run" } => probe.kind === "run" && probe.identity.repo === own.repo && probe.identity.root === own.root;

// Before any card moves: refuse a root a live run holds, else take the first free port.
export const decideStart = (probes: readonly Probe[], own: Identity): Claim => {
  const live = probes.find((probe) => sameRoot(probe, own));
  if (live !== undefined) return { type: "refuse", reason: `a run is already live on ${own.repo}#${own.root}: ${describe(live)}.` };
  const free = probes.find((probe) => probe.kind === "free");
  if (free !== undefined) return { type: "start", port: free.port };
  return { type: "refuse", reason: `all ${probes.length} factory ports are busy: ${probes.map(describe).join("; ")}.` };
};

// After taking `port`: the same root claimed by a run on a lower port wins; this run releases and refuses.
export const decideTie = (probes: readonly Probe[], own: Identity, port: number): Claim => {
  const rival = probes.find((probe) => probe.port < port && sameRoot(probe, own));
  if (rival === undefined) return { type: "start", port };
  return { type: "refuse", reason: `another run started on ${own.repo}#${own.root} at the same time: ${describe(rival)}.` };
};
