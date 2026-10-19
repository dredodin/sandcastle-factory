import { z } from "zod";
import { DISCLAIMER, type Cycle } from "./run.mjs";
import { githubUrl, logFileName, verifyCommand } from "./names.mjs";

const COMMENT_URL = /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/[0-9]+#(?:discussion_r|issuecomment-|pullrequestreview-)[0-9]+$/;

// One unit of work the planner hands out, and the branch it is worked on: a sub-issue or the root
// (no `comments`), or PR comments, under the root's number, with the planner's brief. `repo` is the repo it is worked in.
export const itemSchema = z.object({
  issue: z.string().regex(/^[1-9][0-9]*$/),
  repo: z.string(),
  title: z.string(),
  comments: z.array(z.string().regex(COMMENT_URL)),
  brief: z.string(),
  branch: z.string(),
});
export type Item = z.infer<typeof itemSchema>;

type Kinded = Pick<Item, "issue" | "comments">;

const isIssue = (item: Kinded): boolean => item.comments.length === 0;

// Names the item in branches, logs and console: `42` for an issue, `c<id>` after its first comment for comments.
export const itemSlug = (item: Kinded): string => {
  if (isIssue(item)) return item.issue;
  const id = /[0-9]+$/.exec(item.comments[0] ?? "")?.[0];
  if (id === undefined) throw new Error(`No comment id in ${item.comments[0] ?? ""}.`);
  return `c${id}`;
};

export type RepoRef = { readonly name: string; readonly slug: string };

// Whether the item can be worked: its repo is in the Workspace and holds every comment it carries.
export const itemFits = (item: Pick<Item, "repo" | "comments">, repos: readonly RepoRef[]): boolean => {
  const repo = repos.find((candidate) => candidate.name === item.repo);
  if (repo === undefined) return false;
  return item.comments.every((url) => url.startsWith(`${githubUrl(repo.slug)}/pull/`));
};

const workOf = (item: Kinded, homeUrl: string): string => (isIssue(item) ? `${homeUrl}/issues/${item.issue}` : item.comments.join("\n"));

// What the item's merge commit names: `#<n>` for an issue, the slug for comments, under the root's `Issue:` line.
export const mergeSubject = (item: Kinded): string => (isIssue(item) ? `#${itemSlug(item)}` : itemSlug(item));

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
  const slug = itemSlug(item);
  return {
    promptArgs: {
      WORK: workOf(item, githubUrl(context.home.slug)),
      BRIEF: item.brief,
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
    name: `implement ${slug}`,
    logName: logFileName(`${cycle.number}-${slug}-implement`, item.repo, context.home.name),
  };
};
