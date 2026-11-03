import { z } from "zod";
import { DISCLAIMER, type Cycle } from "./run.mjs";
import { githubUrl, logFileName, verifyCommand } from "./names.mjs";

// One unit of work the planner hands out, and the branch it is worked on: a sub-issue, or the root when it has none,
// or `work`: the task text the plan wrote, with no issue. Exactly one of `issue` and `work` is set; the other is "".
// `repo` is the repo it is worked in.
const itemFields = z.object({
  issue: z.string().regex(/^([1-9][0-9]*)?$/).default(""),
  work: z.string().default(""),
  repo: z.string(),
  title: z.string(),
  branch: z.string(),
});
export type Item = z.infer<typeof itemFields>;

export const planItemSchema = itemFields
  .omit({ branch: true })
  .refine((item) => (item.issue !== "") !== (item.work !== ""), "an item has either an issue or work, not both, not neither");

export const hasIssue = (item: Pick<Item, "issue">): boolean => item.issue !== "";

// What names an item in runs, logs and sandboxes: its issue number, else `work-<n>` from its branch.
export const itemId = (item: Pick<Item, "issue" | "branch">): string =>
  hasIssue(item) ? item.issue : item.branch.slice(item.branch.lastIndexOf("-work-") + 1);

export type RepoRef = { readonly name: string; readonly slug: string };

// Whether the item can be worked: its repo is in the Workspace.
export const itemFits = (item: Pick<Item, "repo">, repos: readonly RepoRef[]): boolean => repos.some((repo) => repo.name === item.repo);

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
      WORK: hasIssue(item) ? `${githubUrl(context.home.slug)}/issues/${item.issue}` : item.work,
      READ: hasIssue(item)
        ? `Read the issue whole. Issues live in \`${context.home.slug}\`; you work in the repo \`${item.repo}\`, the one checked out here: \`gh issue view ${item.issue} --repo ${context.home.slug} --json number,title,body,labels,comments\`. Comments starting \`${DISCLAIMER}\` are the agent's own.`
        : `This task has no issue: the text above is the whole task. You work in the repo \`${item.repo}\`, the one checked out here. Commits reference the root and say what they fix.`,
      ISSUE: hasIssue(item) ? item.issue : String(cycle.root),
      REPORT: hasIssue(item) ? `comments the note on #${item.issue} and moves the card` : "logs the note",
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
