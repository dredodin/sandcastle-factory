// `tsx main.mts <setup | take N | resume N>`: parses arguments and dispatches to a mode. take and resume run setup first.

import { fail, message, parseArgs } from "./shared/cli.mjs";
import { withClaim } from "./shared/claim-socket.mjs";
import { log, timed } from "./shared/logger.mjs";
import { resume } from "./workflow/resume.mjs";
import { setup } from "./workflow/setup.mjs";
import { take } from "./workflow/take.mjs";

const command = parseArgs(process.argv.slice(2));
const ready = await setup(command.mode).catch((error: unknown) => fail(`Setup failed: ${message(error)}`));
// Before anything reads or moves a card.
const claimed = <T,>(root: number, work: () => Promise<T>): Promise<T> => withClaim(ready.env.ports, { repo: ready.workspace.home.slug, root, startedAt: new Date().toISOString() }, work);
switch (command.mode) {
  case "take":
    await timed("take total", async () => log.info(await claimed(command.root, () => take(ready.workspace, ready.env, command.root)))).catch((error: unknown) => fail(`Take failed: ${message(error)}`));
    break;
  case "resume":
    await timed("resume total", async () => log.info(await claimed(command.root, () => resume(ready.workspace, ready.env, command.root)))).catch((error: unknown) => fail(`Resume failed: ${message(error)}`));
    break;
  case "setup":
    break;
}
