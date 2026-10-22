import { mkdirSync, openSync, readdirSync, writeSync } from "node:fs";
import { Writable } from "node:stream";
import { pino } from "pino";
import pretty from "pino-pretty";
import { runFolderName, type Mode, type RunKey } from "./branches.mjs";
import { formatDuration } from "./duration.mjs";

// Every harness message goes to the terminal and, once a run folder is open, to its `console.log`: same text.
const files: { write: (text: Buffer) => void }[] = [];
const tee = new Writable({
  write: (chunk: Buffer, _encoding, done): void => {
    process.stdout.write(chunk);
    files.forEach((file) => file.write(chunk));
    done();
  },
});

export const log = pino(
  pretty({ destination: tee, colorize: false, sync: true, ignore: "level,time,pid,hostname" }),
);

// Creates this run's folder in the home repo and starts copying the console into it. Returns the absolute folder path.
export const openRunLog = (homePath: string, mode: Mode, key: RunKey, branch: string): string => {
  const logsRoot = `${homePath}/.sandcastle/logs`;
  mkdirSync(logsRoot, { recursive: true });
  const logDir = `${logsRoot}/${runFolderName(mode, key, branch, readdirSync(logsRoot))}`;
  mkdirSync(logDir);
  const fd = openSync(`${logDir}/console.log`, "a");
  files.push({ write: (text) => writeSync(fd, text) });
  return logDir;
};

// Runs `work` and logs `<label> took m:ss`, whether it succeeds or fails.
export const timed = async <T,>(label: string, work: () => Promise<T>): Promise<T> => {
  const started = Date.now();
  try {
    return await work();
  } finally {
    log.info(`${label} took ${formatDuration(Date.now() - started)}`);
  }
};
