// `tsx main.mts <setup | take N | resume N>`: parses arguments and dispatches to a mode. take and resume run setup first.

import { fail, message, parseArgs } from "./shared/cli.mjs";
import { log, timed } from "./shared/logger.mjs";
import { resume } from "./workflow/resume.mjs";
import { setup } from "./workflow/setup.mjs";
import { take } from "./workflow/take.mjs";

const command = parseArgs(process.argv.slice(2));
const ready = await setup().catch((error: unknown) => fail(`Setup failed: ${message(error)}`));
switch (command.mode) {
  case "take":
    log.info(await timed("Take", () => take(ready.workspace, ready.env, command.root)).catch((error: unknown) => fail(`Take failed: ${message(error)}`)));
    break;
  case "resume":
    log.info(await timed("Resume", () => resume(ready.workspace, ready.env, command.root)).catch((error: unknown) => fail(`Resume failed: ${message(error)}`)));
    break;
  case "setup":
    break;
}
