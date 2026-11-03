import { z } from "zod";
import { commentSchema, type PlanComment } from "./comments.mjs";
import { itemFits, planItemSchema, type PlanItem, type RepoRef } from "./item.mjs";
import type { Rejection } from "./record.mjs";

export type PlanOutput = { readonly items: readonly PlanItem[]; readonly rejected: readonly Rejection[]; readonly comments: readonly PlanComment[] };

// What the plan agent prints in `<plan>`: its items, the review findings it rejected (each with its repo and a reason), the PR comments it handled.
export const planOutputSchema = (repos: readonly RepoRef[]): z.ZodType<PlanOutput> =>
  z.object({
    items: z.array(planItemSchema.refine((item) => itemFits(item, repos), "item outside the Workspace")),
    rejected: z
      .array(z.object({ repo: z.string(), finding: z.string().min(1), reason: z.string().min(1) }).refine((rejection) => itemFits(rejection, repos), "rejection outside the Workspace"))
      .default([]),
    comments: z.array(commentSchema).default([]),
  });
