// The thin socket shell around `claim.mts`: probes the pool on 127.0.0.1 and holds one port for the run's life.

import { Worker } from "node:worker_threads";
import { decideStart, decideTie, identitySchema, type Identity, type Probe } from "./claim.mjs";

const HOST = "127.0.0.1";
const PROBE_MS = 3_000; // Windows takes ~2 s to refuse a connection to a free loopback port.

const refused = (error: unknown): boolean => error instanceof Error && (error.cause as { code?: string } | undefined)?.code === "ECONNREFUSED";

// A refused connection means free; a timeout or a non-factory answer means foreign.
const probe = async (port: number): Promise<Probe> => {
  const answer = await fetch(`http://${HOST}:${port}/`, { signal: AbortSignal.timeout(PROBE_MS) }).then(
    async (response) => identitySchema.safeParse(await response.json().catch(() => null)),
    (error: unknown): Probe => ({ kind: refused(error) ? "free" : "foreign", port }),
  );
  if ("kind" in answer) return answer;
  return answer.success ? { kind: "run", port, identity: answer.data } : { kind: "foreign", port };
};

const probeAll = (ports: readonly number[]): Promise<readonly Probe[]> => Promise.all(ports.map(probe));

// The server lives in a worker thread: the run shells out with blocking calls, and its own loop would not answer probes meanwhile.
const SERVER = `
const { workerData, parentPort } = require("node:worker_threads");
const { createServer } = require("node:http");
const server = createServer((_request, response) => response.setHeader("Connection", "close").end(JSON.stringify(workerData.identity)));
server.once("error", (error) => parentPort.postMessage(error.code === "EADDRINUSE" ? "busy" : "error:" + error.message));
server.listen(workerData.port, workerData.host, () => parentPort.postMessage("listening"));
`;

// Resolves the holder, or null when the port was taken first; any other error is real.
const listen = (port: number, identity: Identity): Promise<Worker | null> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(SERVER, { eval: true, workerData: { port, host: HOST, identity } });
    worker.once("error", reject);
    worker.once("message", (message: string) => {
      if (message === "listening") {
        worker.unref();
        resolve(worker);
      } else if (message === "busy") void worker.terminate().then(() => resolve(null));
      else void worker.terminate().then(() => reject(new Error(message)));
    });
  });

// Claims the root or throws naming why; runs `work` holding the port, releases it after.
export const withClaim = async <T,>(ports: readonly number[], identity: Identity, work: () => Promise<T>): Promise<T> => {
  for (const _ of ports) {
    const start = decideStart(await probeAll(ports), identity);
    if (start.type === "refuse") throw new Error(start.reason);
    const holder = await listen(start.port, identity);
    if (holder === null) continue;
    const tie = decideTie(await probeAll(ports), identity, start.port);
    if (tie.type === "refuse") {
      await holder.terminate();
      throw new Error(tie.reason);
    }
    try {
      return await work();
    } finally {
      await holder.terminate();
    }
  }
  throw new Error("the factory ports kept changing hands while claiming one; start again.");
};
