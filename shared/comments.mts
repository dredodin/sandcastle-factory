// PR comments the plan handled, and the replies the harness posts under them once the fix is pushed.
import { z } from "zod";
import { DISCLAIMER } from "./run.mjs";

// `id` is the GraphQL node id (a review thread, a top-level comment or a review), `url` the comment's own URL.
const commentFields = {
  id: z.string().min(1),
  pr: z.url(),
  url: z.url(),
  kind: z.enum(["thread", "comment", "review"]),
};

// `item` is the 1-based position in the plan's items of the item a `planned` comment went into; `text` is the reason or the question.
export const commentSchema = z.discriminatedUnion("decision", [
  z.strictObject({ ...commentFields, decision: z.literal("planned"), item: z.number().int().min(1) }),
  z.strictObject({ ...commentFields, decision: z.literal("won't do"), text: z.string().min(1) }),
  z.strictObject({ ...commentFields, decision: z.literal("needs info"), text: z.string().min(1) }),
]);
export type PlanComment = z.infer<typeof commentSchema>;

// A handled comment with the branch of the item it went into ("" when none) and its text ("" when planned).
export type Handled = {
  readonly id: string;
  readonly pr: string;
  readonly url: string;
  readonly kind: PlanComment["kind"];
  readonly decision: PlanComment["decision"];
  readonly text: string;
  readonly branch: string;
};

// The comments the plan handled, each with the branch of its item. `taken`: the plan positions of the items taken, with their branches.
// A planned comment whose item was not taken is dropped: it stays pending for the next cycle.
export const handledOf = (comments: readonly PlanComment[], taken: readonly { readonly position: number; readonly branch: string }[]): readonly Handled[] =>
  comments.flatMap((comment): readonly Handled[] => {
    const handled = (text: string, branch: string): Handled => ({ id: comment.id, pr: comment.pr, url: comment.url, kind: comment.kind, decision: comment.decision, text, branch });
    if (comment.decision !== "planned") return [handled(comment.text, "")];
    const entry = taken.find(({ position }) => position === comment.item);
    return entry === undefined ? [] : [handled("", entry.branch)];
  });

export type Reply = { readonly comment: Handled; readonly body: string; readonly resolve: boolean };

// The reply under a handled comment, or none while its fix has no merge commit (it stays open). `commits`: item branch → merge commit.
// Needs info keeps the comment open. A top-level comment or review body is answered by a new PR comment, which links the one it answers;
// a review body cannot be resolved, so the link is what marks it done.
export const replyOf = (comment: Handled, commits: ReadonlyMap<string, string>): Reply | null => {
  const commit = commits.get(comment.branch);
  if (comment.decision === "planned" && commit === undefined) return null;
  const text = comment.decision === "planned" ? `fixed in ${commit}` : comment.text;
  const answers = comment.kind === "thread" ? [] : [`Re ${comment.url}`];
  return { comment, body: [DISCLAIMER, ...answers, text].join("\n\n"), resolve: comment.decision !== "needs info" };
};

export const handledText = (handled: readonly Handled[]): string =>
  handled.length === 0 ? "(none)" : handled.map((c) => `- ${c.url} (${c.kind} ${c.id}): ${c.decision}${c.text === "" ? "" : ` — ${c.text}`}`).join("\n");
