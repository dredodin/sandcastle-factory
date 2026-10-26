import { execFileSync } from "node:child_process";

// Runs a command in `cwd` and returns its trimmed stdout; a non-zero exit throws.
export const sh = (cwd: string, command: string, ...args: readonly string[]): string =>
  execFileSync(command, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();

// Like `sh`, feeding `input` to the command's stdin.
export const shIn = (cwd: string, input: string, command: string, ...args: readonly string[]): string =>
  execFileSync(command, args, { cwd, input, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();

export const succeeds = (cwd: string, command: string, ...args: readonly string[]): boolean => {
  try {
    sh(cwd, command, ...args);
    return true;
  } catch {
    return false;
  }
};
