// `tsx main.mts <setup | clean | take N | resume N>`: parses arguments and dispatches to a mode. Every mode runs setup first; only take and resume run.

import { fail, message, parseArgs } from "./shared/cli.mjs";
import { withClaim } from "./shared/claim/pipe-claim.mjs";
import { clean } from "./workflow/clean.mjs";
import { log, timed } from "./shared/logger.mjs";
import { resume } from "./workflow/resume.mjs";
import { setup } from "./workflow/setup.mjs";
import { take } from "./workflow/take.mjs";

const command = parseArgs(process.argv.slice(2));
const ready = await setup(command.mode).catch((error: unknown) => fail(`Setup failed: ${message(error)}`));
if (command.mode === "clean") {
  await clean(ready.workspace).catch((error: unknown) => fail(`Clean failed: ${message(error)}`));
} else if (command.mode === "take" || command.mode === "resume") {
  const { run, label } = { take: { run: take, label: "Take" }, resume: { run: resume, label: "Resume" } }[command.mode];
  const { root } = command;
  const identity = { repo: ready.workspace.home.slug, root, startedAt: new Date().toISOString() };
  // The claim comes before anything reads or moves a card.
  await timed(`${command.mode} total`, async () => log.info(await withClaim(identity, () => run(ready.workspace, ready.env, root)))).catch((error: unknown) => fail(`${label} failed: ${message(error)}`));
}
