const SEPARATOR = " -> ";

// A host folder shown read-only inside the sandbox.
export type RepoMount = { readonly hostPath: string; readonly sandboxPath: string; readonly readonly: true };

// The repo's `mounts` file: `<host path> -> <sandbox path>` per line; blank and `#` lines are skipped.
// `file` names the source in errors.
export const parseMounts = (text: string, file: string): readonly RepoMount[] =>
  text.split(/\r?\n/).flatMap((raw, index) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return [];
    const at = line.indexOf(SEPARATOR);
    const hostPath = line.slice(0, at).trim();
    const sandboxPath = line.slice(at + SEPARATOR.length).trim();
    if (at < 0 || hostPath === "" || sandboxPath === "") throw new Error(`${file}:${index + 1}: expected "<host path> -> <sandbox path>", got "${line}"`);
    return [{ hostPath, sandboxPath, readonly: true as const }];
  });
