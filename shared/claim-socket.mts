// The thin socket shell around `claim.mts`: probes the pool on 127.0.0.1 and holds one port for the run's life.

import { createServer, type Server } from "node:http";
import { decideStart, decideTie, identitySchema, type Identity, type Probe } from "./claim.mjs";

const HOST = "127.0.0.1";
const PROBE_MS = 1_000;

const refused = (error: unknown): boolean => error instanceof Error && (error.cause as { code?: string } | undefined)?.code === "ECONNREFUSED";

// A refused connection means free; a timeout or a non-factory answer means foreign.
const probe = async (port: number): Promise<Probe> => {
  const response = await fetch(`http://${HOST}:${port}/`, { signal: AbortSignal.timeout(PROBE_MS) }).catch((error: unknown) => (refused(error) ? null : undefined));
  if (response === null) return { kind: "free", port };
  if (response === undefined) return { kind: "foreign", port };
  const identity = identitySchema.safeParse(await response.json().catch(() => null));
  return identity.success ? { kind: "run", port, identity: identity.data } : { kind: "foreign", port };
};

const probeAll = (ports: readonly number[]): Promise<readonly Probe[]> => Promise.all(ports.map(probe));

const listen = (port: number, identity: Identity): Promise<Server | null> =>
  new Promise((resolve, reject) => {
    const server = createServer((_request, response) => response.setHeader("Connection", "close").end(JSON.stringify(identity)));
    // Only a taken port is a lost race; any other error is real.
    server.once("error", (error: NodeJS.ErrnoException) => (error.code === "EADDRINUSE" ? resolve(null) : reject(error)));
    server.listen(port, HOST, () => {
      server.unref();
      resolve(server);
    });
  });

const close = (server: Server): Promise<void> => new Promise((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  });

// Claims the root or throws naming why; runs `work` holding the port, releases it after.
export const withClaim = async <T,>(ports: readonly number[], identity: Identity, work: () => Promise<T>): Promise<T> => {
  for (let attempt = 0; attempt < ports.length; attempt++) {
    const start = decideStart(await probeAll(ports), identity);
    if (start.type === "refuse") throw new Error(start.reason);
    const server = await listen(start.port, identity);
    if (server === null) continue;
    const tie = decideTie(await probeAll(ports), identity, start.port);
    if (tie.type === "refuse") {
      await close(server);
      throw new Error(tie.reason);
    }
    try {
      return await work();
    } finally {
      await close(server);
    }
  }
  throw new Error("the factory ports kept changing hands while claiming one; start again.");
};
