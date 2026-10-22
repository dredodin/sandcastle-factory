import type { Sandbox } from "@ai-hero/sandcastle";
import { implementRunOf, type Item } from "../../shared/item.mjs";
import { timed } from "../../shared/logger.mjs";
import { promptPath } from "../../shared/paths.mjs";
import { IDLE_TIMEOUT_SECONDS, logging, type Cycle } from "../../shared/run.mjs";
import { otherBranchesText } from "../../shared/text.mjs";

const IMPLEMENT_ITERATIONS = 100;

// Runs the implement agent on the item's branch; returns whether it committed anything.
export const implement = async (cycle: Cycle, sandbox: Sandbox, item: Item): Promise<boolean> => {
  const { home } = cycle.workspace;
  const otherBranches = otherBranchesText(cycle.integrations.opened(), item.repo, cycle.branch);
  const inputs = implementRunOf(item, cycle, { home, otherBranches });
  const result = await timed(`${inputs.name} in ${item.repo}, cycle ${cycle.number}`, () => sandbox.run({
    agent: cycle.agents.IMPLEMENT,
    promptFile: promptPath("implement"),
    promptArgs: inputs.promptArgs,
    maxIterations: IMPLEMENT_ITERATIONS,
    name: inputs.name,
    idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS,
    logging: logging(cycle, inputs.logName),
  }));
  return result.commits.length > 0;
};
