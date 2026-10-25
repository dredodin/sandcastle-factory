const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type Mode = "take" | "resume";

// What names a run's branches: the home repo and the root issue.
export type RunKey = { readonly home: string; readonly root: number };

const takePrefix = ({ home, root }: RunKey): string => `sandcastle/${home}/issue-${root}-take-`;

const takeNumber = (key: RunKey, ref: string): number =>
  Number(new RegExp(`^${escapeRegExp(takePrefix(key))}([0-9]+)$`).exec(ref)?.[1] ?? 0);

export const isTakeBranch = (key: RunKey, branch: string): boolean => takeNumber(key, branch) > 0;

export type OpenPr = { readonly url: string; readonly headRefName: string };

export type RepoPrs = { readonly repo: string; readonly prs: readonly OpenPr[] };

export type RepoRefs = { readonly repo: string; readonly refs: ReadonlySet<string> };

export type LatestTake = { readonly branch: string; readonly repos: readonly string[] };

// The highest-numbered take branch of this root among all repos' refs, and the repos that have it. Open PRs play no part.
export const pickLatestTake = (key: RunKey, repoRefs: readonly RepoRefs[]): LatestTake => {
  const highest = Math.max(0, ...repoRefs.flatMap(({ refs }) => [...refs].map((ref) => takeNumber(key, ref))));
  if (highest === 0) throw new Error(`Nothing to resume for #${key.root}: no take branch. Run \`take\`.`);
  const branch = `${takePrefix(key)}${highest}`;
  return { branch, repos: repoRefs.filter(({ refs }) => refs.has(branch)).map(({ repo }) => repo) };
};

// Throws, naming every open take PR of this root in any repo: `take` must not start beside an open one.
export const assertNoOpenTake = (key: RunKey, repoPrs: readonly RepoPrs[]): void => {
  const takes = repoPrs.flatMap(({ prs }) => prs.filter((pr) => isTakeBranch(key, pr.headRefName)));
  if (takes.length === 0) return;
  throw new Error(`#${key.root} already has an open take PR, \`resume\` it or close it first:\n${takes.map((p) => `  ${p.url}`).join("\n")}`);
};

// K = 1 + the highest take of this root among the home repo's refs.
export const nextTakeBranch = (key: RunKey, refs: ReadonlySet<string>): string =>
  `${takePrefix(key)}${Math.max(0, ...[...refs].map((ref) => takeNumber(key, ref))) + 1}`;

// A branch name for the item that no ref uses yet: re-planned items must not reuse an earlier branch.
export const freeItemBranch = (integration: string, slug: string, refs: ReadonlySet<string>): string => {
  const free = (attempt: number): string => {
    const name = attempt === 1 ? `${integration}-${slug}` : `${integration}-${slug}-${attempt}`;
    return refs.has(name) ? free(attempt + 1) : name;
  };
  return free(1);
};

// `issue-<N>-take-<K>` with K from the integration branch; `issue-<N>-resume-<M>` with M one past the highest existing resume of this issue.
export const runFolderName = (mode: Mode, key: RunKey, branch: string, existing: readonly string[]): string => {
  if (mode === "take") return `issue-${key.root}-take-${takeNumber(key, branch)}`;
  const prefix = `issue-${key.root}-resume-`;
  const numbers = existing.map((name) => (name.startsWith(prefix) ? Number(/^[0-9]+$/.exec(name.slice(prefix.length))?.[0] ?? 0) : 0));
  return `${prefix}${Math.max(0, ...numbers) + 1}`;
};
