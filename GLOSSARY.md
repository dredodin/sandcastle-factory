# sandcastle-factory

An AFK orchestrator: it turns one issue tree into pull requests across several repos, with agents working in sandboxes and no human asked mid-run.

## Repos

**Home repo**:
The repo the factory runs from. It holds the issues, the repo list and the per-machine settings.
_Avoid_: hub, main repo, host repo

**App repo**:
Any repo of the Workspace other than the home repo.
_Avoid_: child repo, target repo

**Workspace**:
The home repo plus every app repo it lists. One run may touch any of them.
_Avoid_: monorepo, project

**Repo label**:
The `repo:<name>` label on an issue, naming the repo its work is done in. No repo label means the home repo.
_Avoid_: routing tag

## Runs

**Root issue**:
The issue a run is started on. Its direct sub-issues are the work; without sub-issues the root itself is.
_Avoid_: epic, parent ticket

**Run**:
One invocation of the factory on a root issue: either a take or a resume.

**Take**:
A run that starts fresh integration branches for a root issue. Takes of one root are numbered 1, 2, 3…
_Avoid_: attempt, try

**Resume**:
A run that continues the latest take of a root issue, found by its branch, from whatever state it stopped in: syncs its branches with GitHub, turns PR comments into issues, then reviews and opens or updates the PR of every repo ahead of its default branch.
_Avoid_: retry, rerun

**Open take**:
A take whose pull requests are still open. A root issue has at most one.

**Cycle**:
One plan → implement → merge pass inside a run. A run repeats cycles until the plan comes back empty.
_Avoid_: round, iteration

**Phase**:
One step in a run: plan, implement, merge, review or PR. Each is an agent's, except a merge without conflicts and with a green verify script: a script does it.
_Avoid_: stage, step

**Item**:
One unit of work a plan hands to one implement agent: an unblocked sub-issue, or the root when it has none. Always in exactly one repo.
_Avoid_: task, job, work unit

## Branches and delivery

**Integration branch**:
The branch a take collects its work on, one per touched repo, with the same name in each.
_Avoid_: feature branch, run branch

**Item branch**:
The short-lived branch one item is implemented on before it is merged into its integration branch.

**Own reply**:
A comment the factory's agents post under the maintainer's account, marked as such. Never read as a request.
_Avoid_: bot comment

## Sandboxes

**Sandbox**:
The isolated place an agent works in: a docker or podman container, or the host itself when there is none.
_Avoid_: VM, environment

**Repo image**:
The container image one repo's agents run in, built on the factory's base image plus what that repo's checks need.
_Avoid_: dev image

**Verify script**:
The repo's own check every agent runs before each commit. A red verify script means no commit.
_Avoid_: CI, pre-commit hook

**Deep verify script**:
The repo's own slow check, optional, run once over a whole branch at each review pass. What it reports goes into the review issue like any review finding.
_Avoid_: slow verify, nightly check

**Plan check script**:
The home repo's own check of what work is due, optional, run by the plan agent every cycle. Passing means no work; what a failing one prints becomes a sub-issue of the root.
_Avoid_: pre-plan hook

## Setup

**Setup wizard**:
The terminal walk-through `setup` opens: the only writer of `.sandcastle/.env`.

**Wizard stage**:
One step of the setup wizard.
_Avoid_: phase
