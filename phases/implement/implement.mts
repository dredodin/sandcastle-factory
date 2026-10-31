import type { Sandbox } from "@ai-hero/sandcastle";
import { z } from "zod";
import { extract } from "../../shared/extract.mjs";
import { implementRunOf, type Item } from "../../shared/item.mjs";
import { message } from "../../shared/cli.mjs";
import { OUTCOMES, type Outcome } from "../../shared/kanban.mjs";
import { log, timed } from "../../shared/logger.mjs";
import { promptPath } from "../../shared/paths.mjs";
import { IDLE_TIMEOUT_SECONDS, phaseAgent, type Cycle } from "../../shared/run.mjs";
import { otherBranchesText } from "../../shared/text.mjs";

const IMPLEMENT_ITERATIONS = 100;

// What an implement run reports: one outcome the harness maps to the sub-issue's move.
export type ImplementOutcome = { readonly outcome: Outcome; readonly note: string };

const outcomeSchema = z.object({
  outcome: z.enum(OUTCOMES),
  note: z.string().default(""),
}) satisfies z.ZodType<ImplementOutcome, unknown>;

// Runs the implement agent on the item's branch; returns the outcome it reported, else the one its commits imply.
export const implement = async (cycle: Cycle, sandbox: Sandbox, item: Item): Promise<ImplementOutcome> => {
  const { home } = cycle.workspace;
  const otherBranches = otherBranchesText(cycle.integrations.opened(), item.repo, cycle.branch);
  const inputs = implementRunOf(item, cycle, { home, otherBranches });
  const result = await timed(`implement ${item.issue}`, () => sandbox.run({
    promptFile: promptPath("implement"),
    promptArgs: inputs.promptArgs,
    maxIterations: IMPLEMENT_ITERATIONS,
    name: inputs.name,
    idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS,
    ...phaseAgent(cycle, "IMPLEMENT", inputs.logName),
  }));
  try {
    return extract(result.stdout, "outcome", outcomeSchema);
  } catch (error) {
    log.warn(`  #${item.issue} outcome unreadable: ${message(error)}`);
    return result.commits.length > 0 ? { outcome: "committed", note: "" } : { outcome: "cannot finish", note: "The implement run ended with no commits and reported no outcome." };
  }
};
