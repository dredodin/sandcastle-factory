// Pure assembly of what the run adds to every PR body: the Closes lines, the models and the run's PR list.
import { z } from "zod";
import type { Item } from "./item.mjs";
import { PHASES, type Phase, type PhaseSetting } from "./env.mjs";

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

// Only the home repo's PR closes the root, so a multi-repo run keeps it open until the home PR merges; with no home PR, every PR does.
export const closesRoot = (repo: string, homeRepo: string, prRepos: readonly string[]): boolean => repo === homeRepo || !prRepos.includes(homeRepo);

const blockedBySchema = z.object({ blockedBy: z.object({ nodes: z.array(z.object({ number: z.number() })) }) });

// Blocker numbers from `gh issue view --json blockedBy`.
export const blockersFromJson = (json: string): readonly number[] => blockedBySchema.parse(JSON.parse(json)).blockedBy.nodes.map((blocker) => blocker.number);

// `acme/app#12` for a PR URL, the URL itself for anything else.
export const prRef = (url: string): string => {
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/([0-9]+)$/.exec(url);
  return match === null ? url : `${match[1]}#${match[2]}`;
};

// PRs in the order they must merge: a PR whose issue is blocked by an issue of another PR comes after it.
// Ties and cycles keep the given order.
export const mergeOrder = (prs: readonly Pr[], blockedBy: BlockedBy): readonly Pr[] => {
  const dependsOn = (pr: Pr, other: Pr): boolean =>
    pr !== other && pr.issues.some((issue) => blockedBy[issue]?.some((blocker) => other.issues.includes(blocker)) ?? false);
  const place = (placed: readonly Pr[], left: readonly Pr[]): readonly Pr[] => {
    const [first] = left;
    if (first === undefined) return placed;
    const next = left.find((pr) => left.every((other) => !dependsOn(pr, other))) ?? first;
    return place([...placed, next], left.filter((pr) => pr !== next));
  };
  return place([], prs);
};

// The repos the run planned issues in that got no PR, each with its planned issues, which stay open.
export const reposWithoutPr = (planned: readonly Pick<Item, "repo" | "issue">[], prRepos: readonly string[]): readonly NoPr[] =>
  [...new Set(planned.map((item) => item.repo))]
    .filter((repo) => !prRepos.includes(repo))
    .map((repo) => ({
      repo,
      open: [...new Set(planned.filter((item) => item.repo === repo).map((item) => Number(item.issue)))],
    }));

const issueList = (issues: readonly number[]): string => issues.map((id) => `#${id}`).join(", ");

// One line naming the model each phase ran with.
export const modelsLine = (phases: Readonly<Record<Phase, PhaseSetting>>): string =>
  `Models: ${PHASES.map((phase) => `${phase} \`${phases[phase].model}\` (${phases[phase].provider}, ${phases[phase].effort})`).join(", ")}.`;

// The block every PR of the run ends with: the models line, then the run's PR list when it has several PRs or a repo left out.
export const runBlock = (models: string, homeSlug: string, root: number, prs: readonly Pr[], noPr: readonly NoPr[], blockedBy: BlockedBy): string => {
  const run =
    prs.length <= 1 && noPr.length === 0
      ? []
      : [
          "",
          "## Run",
          "",
          `One change over several repos, root ${homeSlug}#${root}. Merge in this order:`,
          "",
          ...mergeOrder(prs, blockedBy).map((pr, index) => `${index + 1}. ${prRef(pr.url)} (${pr.repo})`),
          ...noPr.map((entry) => `\nNo PR in \`${entry.repo}\`: no commits. Still open: ${issueList(entry.open)}.`),
        ];
  return [START, models, ...run, END].join("\n");
};

// The body with the run block replaced, or appended on a first pass.
export const withRunBlock = (body: string, block: string): string => {
  const stripped = body.replace(new RegExp(`\\n*${START}[\\s\\S]*?${END}\\n*`), "\n").trimEnd();
  return `${stripped}\n\n${block}\n`;
};
