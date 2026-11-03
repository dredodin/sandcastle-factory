import { z } from "zod";
import { commentSchema } from "./comments.mjs";
import { itemFits, planItemSchema, type RepoRef } from "./item.mjs";

// What the plan agent prints in `<plan>`: its items, the review findings it rejected (each with its repo and a reason), the PR comments it handled.
export const planOutputSchema = (repos: readonly RepoRef[]) =>
  z.object({
    items: z.array(planItemSchema.refine((item) => itemFits(item, repos), "item outside the Workspace")),
    rejected: z
      .array(z.object({ repo: z.string(), finding: z.string().min(1), reason: z.string().min(1) }).refine((rejection) => itemFits(rejection, repos), "rejection outside the Workspace"))
      .default([]),
    comments: z.array(commentSchema).default([]),
  });
