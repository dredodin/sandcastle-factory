import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { replyOf, type Reply } from "../../shared/comments.mjs";
import { log } from "../../shared/logger.mjs";
import type { Run } from "../../shared/run.mjs";
import { sh } from "../../shared/shell.mjs";

const REPLY_THREAD = "mutation($id: ID!, $body: String!) { addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $id, body: $body}) { comment { id } } }";
const RESOLVE_THREAD = "mutation($id: ID!) { resolveReviewThread(input: {threadId: $id}) { thread { id } } }";
const MINIMIZE = "mutation($id: ID!) { minimizeComment(input: {subjectId: $id, classifier: RESOLVED}) { minimizedComment { isMinimized } } }";

// Posts one reply, then resolves the comment: a thread is resolved, a top-level comment hidden, a review body left as it is.
const post = (cwd: string, { comment, body, resolve }: Reply, file: string): void => {
  writeFileSync(file, body);
  if (comment.kind === "thread") {
    sh(cwd, "gh", "api", "graphql", "-f", `query=${REPLY_THREAD}`, "-f", `id=${comment.id}`, "-F", `body=@${file}`);
    if (resolve) sh(cwd, "gh", "api", "graphql", "-f", `query=${RESOLVE_THREAD}`, "-f", `id=${comment.id}`);
    return;
  }
  sh(cwd, "gh", "pr", "comment", comment.pr, "--body-file", file);
  if (resolve && comment.kind === "comment") sh(cwd, "gh", "api", "graphql", "-f", `query=${MINIMIZE}`, "-f", `id=${comment.id}`);
};

// After the push: a reply under each handled comment, and the comment closed unless it needs info.
// A comment whose item is not merged gets nothing and stays open. A failed post is logged, never stops the run.
export const postReplies = (run: Run): void => {
  const commits = new Map(run.record.mergedItems().map(({ item, commit }) => [item.branch, commit]));
  const dir = mkdtempSync(join(tmpdir(), "sandcastle-reply-"));
  const cwd = run.workspace.home.path;
  run.record.handled().forEach((comment, index) => {
    const reply = replyOf(comment, commits);
    if (reply === null) return log.warn(`  Comment ${comment.id}: its item is not merged; left open.`);
    try {
      post(cwd, reply, join(dir, `${index}.md`));
    } catch (error) {
      log.warn(`  Comment ${comment.id}: reply failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
};
