---
name: run-factory
description: Run the factory on an issue and report back. Use when asked to take, resume or run the factory / AFK agent / sandcastle on an issue. Starts `take` or `resume` in the background, waits for its exit, fixes known failures, reports the PRs or the failure and the slow phases.
---

# Run factory

Run in the home repo. One run, start to report. A run takes minutes to hours, and its phase count is decided mid-run: never estimate its total time.

## 1. Start

`take <issue>` for a fresh issue, `resume <issue>` to continue its latest take; the human's words pick. Start it as a background command that notifies you on exit (Claude Code: Bash with `run_in_background`; Windows: Git Bash, never PowerShell or cmd):

```sh
npm run sandcastle -- take <issue>
```

Done: the command runs in the background.

## 2. Wait

Wait for the exit notice: it is the only signal. Reading the log on a `sleep` loop meanwhile blocks you and tells nothing the notice will not. You never stop the run, however long. Between start and notice, do other work the human asks for, or end your turn.

Done: the exit notice arrived, with the exit code.

## 3. Read

The run's output prints `log folder: <path>`; read `<path>/console.log`. No such line (setup failed first): the output is all there is.

- Exit 0: the `PR:` block lists one link per repo, or the run says why there is none (`Nothing completed: no PR.`, `Nothing to resume`).
- Non-zero: the last lines say `Take failed: …` or `Resume failed: …`.
- Slow lines: a phase or `setup.sh` line reads `<label>: <duration> (median <d>)`, ending `, slow)` past twice its median on this machine. For each, read its log, the latest `log: NNN-….log` line above it of that name:

  | Line | Log |
  | --- | --- |
  | `plan <cycle>` | `NNN-plan-<home>.log` |
  | `implement <id>` | `NNN-implement-<id>-<repo>.log` |
  | `merge <repo>`, `merge-default <repo>` | `NNN-<same>-script-<repo>.log`, then `NNN-<same>-agent-<repo>.log` if any |
  | `review <repo>`, `pr <repo>` | `NNN-<same>-<repo>.log` |
  | `open … setup.sh` | none: name it slow only |

  Give 1–2 lines on why it was slow, from that log.

Done: you know the PRs or the failure, and why every slow line was slow.

## 4. Known failure

Failed: match the failure lines against [`known-issues.md`](known-issues.md).

- Match: apply its fix, then go back to step 1 with `resume <issue>` (or what the entry says). One attempt per entry: the same failure again → step 5.
- No match, and the failure line names a fix on this machine (a command to run, a service to start) that needs no secret and no decision of the human's: apply it, back to step 1 once as above. It got past that failure: the report carries a new entry for the registry.
- Otherwise: step 5.

Done: the run succeeded, or its failure has no fix left to try.

## 5. Report

To the human:

- The PR links, or the failure line and what you tried.
- Each slow line: the line and why.
- A failure you fixed that the registry lacks: a ready entry in its format, for the human to add to the factory's `skills/run-factory/known-issues.md`.

Stop here. Reading and reviewing the PRs is the human's.
