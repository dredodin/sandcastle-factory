---
name: run-factory
description: Run the factory (take or resume an issue), wait for it, report the PRs or the failure.
---

# Run factory

Host only. Inside a factory sandbox (cwd under `.sandcastle/worktrees/`, or home `/home/agent`): stop and say so.

## 1. Start

From the home repo root, as a background command that notifies you on exit (Claude Code: Bash with `run_in_background`; Windows: Git Bash):

| Command | Example | When |
| --- | --- | --- |
| `take <issue>` | `npm run sandcastle -- take 42` | First run on the issue. |
| `resume <issue>` | `npm run sandcastle -- resume 42` | Continue its latest take: after a failure, after PR comments. |
| `setup` | `npm run sandcastle -- setup` | Never from here: interactive, the human runs it. |

## 2. Wait

For the exit notice only. Never poll, never stop the run.

## 3. Read

The output names the run's log folder. Its `console.log` ends with the PR links, or the failure. A phase marked `slow`: open that phase's log in the same folder and find why.

## 4. Fix

Failed: look the failure up in [`known-issues.md`](known-issues.md). Listed: apply the fix, run the command its row says, back to step 2. Not listed but the fix is obvious and needs nothing from the human: same. One attempt per failure.

## 5. Report

- The PR links, or the failure and what you tried.
- Each `slow` phase and why.
- A failure fixed in step 4 that `known-issues.md` lacks: its new row.
