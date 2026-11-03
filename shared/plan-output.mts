import { z } from "zod";
import { itemFits, planItemSchema, type RepoRef } from "./item.mjs";

// What the plan agent prints in `<plan>`: its items, the issues it created, the review findings it rejected (each with a reason).
export const planOutputSchema = (repos: readonly RepoRef[]) =>
  z.object({
    items: z.array(planItemSchema.refine((item) => itemFits(item, repos), "item outside the Workspace")),
    created: z.array(z.string().regex(/^[1-9][0-9]*$/)).default([]),
    rejected: z.array(z.object({ finding: z.string().min(1), reason: z.string().min(1) })).default([]),
  });
