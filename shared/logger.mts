import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync, writeSync } from "node:fs";
import { Writable } from "node:stream";
import { pino } from "pino";
import pretty from "pino-pretty";
import prettyMs from "pretty-ms";
import { runFolderName, type Mode, type RunKey } from "./branches.mjs";
import { logFileName } from "./names.mjs";
import { baselineText, parseStats, withSample, type Stats } from "./stats.mjs";

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

// This machine's phase stats, beside the run folders; set once a run folder is open.
const statsFiles: string[] = [];

// Creates this run's folder in the home repo and starts copying the console into it. Returns the absolute folder path.
export const openRunLog = (homePath: string, mode: Mode, key: RunKey, branch: string): string => {
  const logsRoot = `${homePath}/.sandcastle/logs`;
  mkdirSync(logsRoot, { recursive: true });
  const logDir = `${logsRoot}/${runFolderName(mode, key, branch, readdirSync(logsRoot))}`;
  mkdirSync(logDir);
  statsFiles.push(`${homePath}/.sandcastle/stats.json`);
  const fd = openSync(`${logDir}/console.log`, "a");
  files.push({ write: (text) => writeSync(fd, text) });
  return logDir;
};

// Hands out a run's log files. `next` numbers the file, names it on the console and returns its path.
export type RunLogs = { readonly next: (base: string, repo: string) => string };

export const runLogs = (logDir: string): RunLogs => {
  const state = { last: 0 };
  return {
    next: (base, repo) => {
      state.last += 1;
      const name = logFileName(state.last, base, repo);
      log.info(`log: ${name}`);
      return `${logDir}/${name}`;
    },
  };
};

// Runs `work` and logs how long it took as `<label>: <duration>`, also when it fails.
export const timed = async <T,>(label: string, work: () => Promise<T>): Promise<T> => {
  const started = performance.now();
  try {
    return await work();
  } finally {
    log.info(`${label}: ${prettyMs(performance.now() - started)}`);
  }
};

// Read fresh each time: runs of other roots on this machine write the same file.
const readStats = (path: string): Stats => {
  if (!existsSync(path)) return {};
  try {
    return parseStats(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${path} unreadable, delete it to start the stats over: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// `timed` for a phase or setup.sh: the line also carries the median of `key` (`<phase kind or setup.sh> <repo>`) on this machine, and `slow` past twice it.
// A success adds its duration to the stats; a failure does not.
export const timedPhase = async <T,>(label: string, key: string, work: () => Promise<T>): Promise<T> => {
  const started = performance.now();
  const finish = (succeeded: boolean): void => {
    const ms = performance.now() - started;
    const path = statsFiles[0];
    const stats = path === undefined ? {} : readStats(path);
    log.info(`${label}: ${prettyMs(ms)}${baselineText(stats[key] ?? [], ms)}`);
    if (succeeded && path !== undefined) writeFileSync(path, `${JSON.stringify(withSample(stats, key, Math.round(ms)))}
`);
  };
  try {
    const result = await work();
    finish(true);
    return result;
  } catch (error) {
    finish(false);
    throw error;
  }
};
