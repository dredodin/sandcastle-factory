import { z } from "zod";
import { DISCLAIMER, type Cycle } from "./run.mjs";
import { githubUrl, logFileName, verifyCommand } from "./names.mjs";

// Where an item comes from: an issue, or `work` the plan made from a review report, PR comments or plan check output.
const SOURCES = ["issue", "review", "comment", "plan check"] as const;

// One unit of work the planner hands out, and the branch it is worked on: a sub-issue, or the root when it has none,
// or `work`: the task text the plan wrote, with no issue. Exactly one of `issue` and `work` is set; the other is "".
// `repo` is the repo it is worked in.
const itemFields = z.object({
  issue: z.string().regex(/^([1-9][0-9]*)?$/).default(""),
  work: z.string().default(""),
  source: z.enum(SOURCES).default("issue"),
  repo: z.string(),
  title: z.string(),
  branch: z.string(),
});
export type Item = z.infer<typeof itemFields>;

export const planItemSchema = itemFields
  .omit({ branch: true })
  .refine((item) => (item.issue !== "") !== (item.work !== ""), "an item has either an issue or work, not both, not neither")
  .refine((item) => (item.issue !== "") === (item.source === "issue"), "a work item names its source, an issue item none");
export type PlanItem = z.infer<typeof planItemSchema>;

export const hasIssue = (item: Pick<Item, "issue">): boolean => item.issue !== "";

const WORK = "work-";

// What names an item in runs, logs and sandboxes: its issue number, else `work-<n>` from its branch.
export const itemId = (item: Pick<Item, "issue" | "branch">): string =>
  hasIssue(item) ? item.issue : item.branch.slice(item.branch.lastIndexOf(`-${WORK}`) + 1);

// The plan's items the Kanban let start (`started`, same order), each with its 1-based plan position and the slug its branch is named by:
// its issue, else `work-<n>` counted over the taken items.
export const takenItems = <T extends Pick<Item, "issue">>(
  items: readonly T[],
  started: readonly boolean[],
): readonly { readonly item: T; readonly position: number; readonly slug: string }[] =>
  items
    .flatMap((item, index) => (started[index] ? [{ item, position: index + 1 }] : []))
    .map(({ item, position }, index) => ({ item, position, slug: hasIssue(item) ? item.issue : `${WORK}${index + 1}` }));

export type RepoRef = { readonly name: string; readonly slug: string };

// Whether the item can be worked: its repo is in the Workspace.
export const itemFits = (item: Pick<Item, "repo">, repos: readonly RepoRef[]): boolean => repos.some((repo) => repo.name === item.repo);

// The prompt arguments that differ between an issue item and a work item.
const variantArgs = (item: Item, root: number, homeSlug: string): Readonly<Record<"WORK" | "READ" | "ISSUE" | "REPORT", string>> => {
  if (!hasIssue(item))
    return {
      WORK: item.work,
      READ: `This task has no issue: the text above is the whole task. You work in the repo \`${item.repo}\`, the one checked out here. Commits reference the root and say what they fix.`,
      ISSUE: String(root),
      REPORT: "logs the note",
    };
  return {
    WORK: `${githubUrl(homeSlug)}/issues/${item.issue}`,
    READ: `Read the issue whole. Issues live in \`${homeSlug}\`; you work in the repo \`${item.repo}\`, the one checked out here: \`gh issue view ${item.issue} --repo ${homeSlug} --json number,title,body,labels,comments\`. Comments starting \`${DISCLAIMER}\` are the agent's own.`,
    ISSUE: item.issue,
    REPORT: `comments the note on #${item.issue} and moves the card`,
  };
};

// Everything one implement run is given: every prompt argument, and the names of the run and its log.
export const implementRunOf = (
  item: Item,
  cycle: Pick<Cycle, "number" | "root">,
  context: { readonly home: RepoRef; readonly otherBranches: string },
): {
  readonly promptArgs: Readonly<Record<string, string>>;
  readonly name: string;
  readonly logName: string;
} => {
  return {
    promptArgs: {
      ...variantArgs(item, cycle.root, context.home.slug),
      TITLE: item.title,
      ROOT: String(cycle.root),
      BRANCH: item.branch,
      DISCLAIMER,
      HOME_SLUG: context.home.slug,
      REPO_NAME: item.repo,
      VERIFY: verifyCommand(item.repo),
      OTHER_BRANCHES: context.otherBranches,
    },
    name: `implement ${itemId(item)}`,
    logName: logFileName(`${cycle.number}-${itemId(item)}-implement`, item.repo, context.home.name),
  };
};
