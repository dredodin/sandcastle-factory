// `tsx main.mts <setup | clean | take N | resume N>`: parses arguments and dispatches to a mode. setup, take and resume run setup; clean only resolves the workspace.

import { fail, message, parseArgs } from "./shared/cli.mjs";
import { withClaim } from "./shared/claim/pipe-claim.mjs";
import { clean } from "./workflow/clean.mjs";
import { log, timed } from "./shared/logger.mjs";
import { resume } from "./workflow/resume.mjs";
import { setup } from "./workflow/setup.mjs";
import { take } from "./workflow/take.mjs";
import { readLayout, resolveWorkspace, sourcePaths } from "./shared/workspace.mjs";

const command = parseArgs(process.argv.slice(2));
if (command.mode === "clean") {
  const layout = readLayout(process.cwd());
  await clean(resolveWorkspace(layout, sourcePaths(layout))).catch((error: unknown) => fail(`Clean failed: ${message(error)}`));
} else {
  const ready = await setup(command.mode).catch((error: unknown) => fail(`Setup failed: ${message(error)}`));
  if (command.mode === "take" || command.mode === "resume") {
    const { run, label } = { take: { run: take, label: "Take" }, resume: { run: resume, label: "Resume" } }[command.mode];
    const { root } = command;
    const identity = { repo: ready.workspace.home.slug, root, startedAt: new Date().toISOString() };
    // The claim comes before anything reads or moves a card.
    await timed(`${command.mode} total`, async () => log.info(await withClaim(identity, () => run(ready.workspace, ready.env, root)))).catch((error: unknown) => fail(`${label} failed: ${message(error)}`));
  }
}
