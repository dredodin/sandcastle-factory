// Pure assembly of what the run adds to every PR body: the Closes lines and the run's PR list.

export type Pr = {
  readonly repo: string;
  readonly url: string;
  // Sub-issues merged into this PR's branch, the root left out.
  readonly issues: readonly number[];
};

// A repo the run planned work in but that got no PR; `open` are its planned issues that stay open.
export type NoPr = { readonly repo: string; readonly open: readonly number[] };

export type BlockedBy = Readonly<Record<number, readonly number[]>>;

const START = "<!-- sandcastle-run -->";
const END = "<!-- /sandcastle-run -->";

// Issues live in the home repo, so every line names it.
export const closesLines = (homeSlug: string, ids: readonly number[]): string => ids.map((id) => `Closes ${homeSlug}#${id}`).join("\n");

// `acme/app#12` for a PR URL, the URL itself for anything else.
export const prRef = (url: string): string => {
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/([0-9]+)$/.exec(url);
  return match === null ? url : `${match[1]}#${match[2]}`;
};

// PRs in the order they must merge: a PR whose issue is blocked by an issue of another PR comes after it.
// Ties and cycles keep the given order.
export const mergeOrder = (prs: readonly Pr[], blockedBy: BlockedBy): readonly Pr[] => {
  const dependsOn = (pr: Pr, other: Pr): boolean =>
    pr !== other && pr.issues.some((issue) => (blockedBy[issue] ?? []).some((blocker) => other.issues.includes(blocker)));
  const place = (placed: readonly Pr[], left: readonly Pr[]): readonly Pr[] => {
    const [first] = left;
    if (first === undefined) return placed;
    const next = left.find((pr) => left.every((other) => !dependsOn(pr, other))) ?? first;
    return place([...placed, next], left.filter((pr) => pr !== next));
  };
  return place([], prs);
};

// The repos the run planned issues or comments in that got no PR, each with its planned issues, which stay open.
export const reposWithoutPr = (planned: readonly { readonly repo: string; readonly issue: string; readonly comments: readonly string[] }[], prRepos: readonly string[]): readonly NoPr[] =>
  [...new Set(planned.map((item) => item.repo))]
    .filter((repo) => !prRepos.includes(repo))
    .map((repo) => ({
      repo,
      open: [...new Set(planned.filter((item) => item.repo === repo && item.comments.length === 0).map((item) => Number(item.issue)))],
    }));

const issueList = (issues: readonly number[]): string => issues.map((id) => `#${id}`).join(", ");

// The block every PR of the run ends with; empty when the run has one PR and nothing left out.
export const runBlock = (homeSlug: string, root: number, prs: readonly Pr[], noPr: readonly NoPr[], blockedBy: BlockedBy): string => {
  if (prs.length <= 1 && noPr.length === 0) return "";
  const lines = [
    START,
    "## Run",
    "",
    `One change over several repos, root ${homeSlug}#${root}. Merge in this order:`,
    "",
    ...mergeOrder(prs, blockedBy).map((pr, index) => `${index + 1}. ${prRef(pr.url)} (${pr.repo})`),
    ...noPr.map((entry) => `\nNo PR in \`${entry.repo}\`: no commits.${entry.open.length > 0 ? ` Still open: ${issueList(entry.open)}.` : ""}`),
    END,
  ];
  return lines.join("\n");
};

// The body with the run block replaced, or appended on a first pass.
export const withRunBlock = (body: string, block: string): string => {
  const stripped = body.replace(new RegExp(`\\n*${START}[\\s\\S]*?${END}\\n*`), "\n").trimEnd();
  return block === "" ? stripped : `${stripped}\n\n${block}\n`;
};
