import type { MountConfig } from "@ai-hero/sandcastle";

const SEPARATOR = " -> ";

// The repo's `mounts` file: `<host path> -> <sandbox path>` per line; blank and `#` lines are skipped.
// `file` names the source in errors.
export const parseMounts = (text: string, file: string): readonly MountConfig[] =>
  text.split(/\r?\n/).flatMap((raw, index) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return [];
    const separatorAt = line.indexOf(SEPARATOR);
    if (separatorAt === -1) throw new Error(`${file}:${index + 1}: expected "<host path> -> <sandbox path>", got "${line}"`);
    const hostPath = line.slice(0, separatorAt).trim();
    const sandboxPath = line.slice(separatorAt + SEPARATOR.length).trim();
    return [{ hostPath, sandboxPath, readonly: true }];
  });
