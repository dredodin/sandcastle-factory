import type { Sandbox } from "@ai-hero/sandcastle";
import { z } from "zod";
import { extract } from "../../shared/extract.mjs";
import { implementRunOf, type Item } from "../../shared/item.mjs";
import { message } from "../../shared/cli.mjs";
import { log, timed } from "../../shared/logger.mjs";
import { OUTCOMES, missingOutcome, reconcile, type ImplementOutcome } from "../../shared/outcome.mjs";
import { promptPath } from "../../shared/paths.mjs";
import { IDLE_TIMEOUT_SECONDS, phaseAgent, type Cycle } from "../../shared/run.mjs";
import { otherBranchesText } from "../../shared/text.mjs";

const IMPLEMENT_ITERATIONS = 100;

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
  const commits = result.commits.length;
  try {
    return reconcile(extract(result.stdout, "outcome", outcomeSchema), commits);
  } catch (error) {
    log.warn(`  #${item.issue} outcome unreadable: ${message(error)}`);
    return missingOutcome(commits);
  }
};
