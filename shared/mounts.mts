import type { MountConfig } from "@ai-hero/sandcastle";

const SEPARATOR = " -> ";
const WRITABLE = " (rw)";

// The repo's `mounts` file: `<host path> -> <sandbox path>` per line, read-only unless it ends in ` (rw)`; blank and `#` lines are skipped.
// `file` names the source in errors.
export const parseMounts = (text: string, file: string): readonly MountConfig[] =>
  text.split(/\r?\n/).flatMap((raw, index) => {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#")) return [];
    const writable = trimmed.endsWith(WRITABLE);
    const line = writable ? trimmed.slice(0, -WRITABLE.length).trim() : trimmed;
    const separatorAt = line.indexOf(SEPARATOR);
    if (separatorAt === -1) throw new Error(`${file}:${index + 1}: expected "<host path> -> <sandbox path>", got "${line}"`);
    const hostPath = line.slice(0, separatorAt).trim();
    const sandboxPath = line.slice(separatorAt + SEPARATOR.length).trim();
    return [{ hostPath, sandboxPath, readonly: !writable }];
  });
