// PR comments the plan handled, and the replies the harness posts under them once the fix is pushed.
import { z } from "zod";
import { DISCLAIMER } from "./run.mjs";

export const DECISIONS = ["planned", "won't do", "needs info"] as const;

// `id` is the GraphQL node id (a review thread, a top-level comment or a review); `text` is the reason or the question.
// `item` is the 1-based position in the plan's items of the item a `planned` comment went into.
export const commentSchema = z
  .object({
    id: z.string().min(1),
    pr: z.url(),
    kind: z.enum(["thread", "comment", "review"]),
    decision: z.enum(DECISIONS),
    text: z.string().default(""),
    item: z.number().int().min(1).optional(),
  })
  .refine((c) => (c.decision === "planned") === (c.item !== undefined), "a planned comment names its item, any other names none")
  .refine((c) => c.decision === "planned" || c.text !== "", "a decision other than planned gives a reason or question");
export type PlanComment = z.infer<typeof commentSchema>;

// A handled comment with the branch of the item it went into ("" when none).
export type Handled = Omit<PlanComment, "item"> & { readonly branch: string };

export type Reply = { readonly comment: Handled; readonly body: string; readonly resolve: boolean };

// The reply under a handled comment, or none while its fix is not merged (it stays open). `commits`: item branch → merge commit.
// Needs info keeps the comment open; a review body cannot be resolved, so it is replied to only.
export const replyOf = (comment: Handled, commits: ReadonlyMap<string, string>): Reply | null => {
  const commit = commits.get(comment.branch);
  if (comment.decision === "planned" && commit === undefined) return null;
  const text = comment.decision === "planned" ? `fixed in ${commit}` : comment.text;
  return { comment, body: `${DISCLAIMER}\n\n${text}`, resolve: comment.decision !== "needs info" };
};

// Prompt text for the comments handled so far.
export const handledText = (handled: readonly Handled[]): string =>
  handled.length === 0 ? "(none)" : handled.map((c) => `- ${c.pr} ${c.kind} ${c.id}: ${c.decision}${c.text === "" ? "" : ` — ${c.text}`}`).join("\n");
