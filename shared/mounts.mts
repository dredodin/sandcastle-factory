const SEPARATOR = " -> ";

// A host folder shown read-only inside the sandbox.
export type RepoMount = { readonly hostPath: string; readonly sandboxPath: string; readonly readonly: true };

// The repo's `mounts` file: `<host path> -> <sandbox path>` per line; blank and `#` lines are skipped.
// `file` names the source in errors.
export const parseMounts = (text: string, file: string): readonly RepoMount[] =>
  text.split(/\r?\n/).flatMap((raw, index) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return [];
    if (!line.includes(SEPARATOR)) throw new Error(`${file}:${index + 1}: expected "<host path> -> <sandbox path>", got "${line}"`);
    const separatorAt = line.indexOf(SEPARATOR);
    const hostPath = line.slice(0, separatorAt).trim();
    const sandboxPath = line.slice(separatorAt + SEPARATOR.length).trim();
    return [{ hostPath, sandboxPath, readonly: true as const }];
  });
