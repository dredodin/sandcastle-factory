import { z } from "zod";
import { DISCLAIMER, type Cycle } from "./run.mjs";
import { githubUrl, logFileName, verifyCommand } from "./names.mjs";

// One unit of work the planner hands out, and the branch it is worked on: a sub-issue, or the root when it has none.
// `repo` is the repo it is worked in.
export const itemSchema = z.object({
  issue: z.string().regex(/^[1-9][0-9]*$/),
  repo: z.string(),
  title: z.string(),
  branch: z.string(),
});
export type Item = z.infer<typeof itemSchema>;

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
      WORK: `${githubUrl(context.home.slug)}/issues/${item.issue}`,
      ISSUE: item.issue,
      TITLE: item.title,
      ROOT: String(cycle.root),
      BRANCH: item.branch,
      DISCLAIMER,
      HOME_SLUG: context.home.slug,
      REPO_NAME: item.repo,
      VERIFY: verifyCommand(item.repo),
      OTHER_BRANCHES: context.otherBranches,
    },
    name: `implement ${item.issue}`,
    logName: logFileName(`${cycle.number}-${item.issue}-implement`, item.repo, context.home.name),
  };
};
