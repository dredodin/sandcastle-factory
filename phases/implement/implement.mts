import type { Sandbox } from "@ai-hero/sandcastle";
import { z } from "zod";
import { extract } from "../../shared/extract.mjs";
import { implementRunOf, itemId, type Item } from "../../shared/item.mjs";
import { message } from "../../shared/cli.mjs";
import { OUTCOMES, reconcile, type ImplementOutcome } from "../../shared/kanban.mjs";
import { log, timed } from "../../shared/logger.mjs";
import { promptPath } from "../../shared/paths.mjs";
import { IDLE_TIMEOUT_SECONDS, phaseAgent, type Cycle } from "../../shared/run.mjs";
import { otherBranchesText } from "../../shared/text.mjs";

const IMPLEMENT_ITERATIONS = 100;

const outcomeSchema = z.object({
  outcome: z.enum(OUTCOMES),
  note: z.string().default(""),
}) satisfies z.ZodType<ImplementOutcome, unknown>;

// Runs the implement agent on the item's branch; returns the outcome it reported reconciled with its commits, else the one its commits imply.
export const implement = async (cycle: Cycle, sandbox: Sandbox, item: Item): Promise<ImplementOutcome> => {
  const { home } = cycle.workspace;
  const otherBranches = otherBranchesText(cycle.integrations.opened(), item.repo, cycle.branch);
  const inputs = implementRunOf(item, cycle, { home, otherBranches });
  const result = await timed(`implement ${itemId(item)}`, () => sandbox.run({
    promptFile: promptPath("implement"),
    promptArgs: inputs.promptArgs,
    maxIterations: IMPLEMENT_ITERATIONS,
    name: inputs.name,
    idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS,
    ...phaseAgent(cycle, "IMPLEMENT", inputs.logBase, item.repo),
  }));
  try {
    return reconcile(extract(result.stdout, "outcome", outcomeSchema), result.commits.length);
  } catch (error) {
    log.warn(`  ${itemId(item)} outcome unreadable: ${message(error)}`);
    return result.commits.length > 0 ? { outcome: "committed", note: "" } : { outcome: "cannot finish", note: "The implement run ended with no commits and reported no outcome." };
  }
};
