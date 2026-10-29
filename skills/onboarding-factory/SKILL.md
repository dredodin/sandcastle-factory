---
name: onboarding-factory
description: Stand up this repo as a sandcastle-factory home repo, or add app repos to its Workspace. Run in the home repo.
disable-model-invocation: true
---

# Onboarding factory

Run in the home repo. Steps in order; each opens with its **done-check**: holds → skip the step. A rerun adds new app repos and finishes whatever is left: there are no modes.

Terms (home repo, app repo, Workspace, repo image, verify script, setup wizard): the factory's `GLOSSARY.md`, at `node_modules/sandcastle-factory/GLOSSARY.md` once step 4 installed it.

## 1. Engineering skills

Done-check: each skill below has a folder in `.claude/skills/`.

Each missing one, from `mattpocock/skills`:

```sh
npx skills add mattpocock/skills -a claude-code -s <name> --copy -y
```

code-review, codebase-design, diagnosing-bugs, domain-modeling, grill-with-docs, grilling, implement, improve-codebase-architecture, pr, research, retro, setup-matt-pocock-skills, tdd, to-spec, to-tickets, triage, wait-what, wayfinder, writing-for-agents.

`show-me`: `npx skills add humanlayer/skills -a claude-code -s show-me --copy -y`.

`--copy` always: real files, no `.agents/`, no junction. Never `skills update`: it has no `--copy`.

## 2. Workspace repos

Done-check: none, always ask.

Show the repos the Workspace has now (`GLOSSARY-MAP.md`'s `## Repos` links; no map: the home repo alone) and ask the human which app repos to add, by name: the GitHub repo name, as `.sandcastle/repos/<name>/` will spell it. The agreed list is the Workspace for every later step.

## 3. Tracker, labels, domain docs

Done-check: `docs/agents/issue-tracker.md` and `docs/agents/domain.md` exist, and every app repo of step 2 has its link in `GLOSSARY-MAP.md`'s `## Repos`.

Read `.claude/skills/setup-matt-pocock-skills/SKILL.md` and walk it here, in this conversation: it is user-invoked, so it cannot be fired. Its questions go to the human as it says. One override, Section C's layout, decided by the Workspace rather than monorepo signals:

- Home repo alone: single-context, one `GLOSSARY.md`, no map.
- App repos: multi-context. `GLOSSARY-MAP.md` gets a `## Repos` section, one link per app repo:

  ```markdown
  ## Repos

  App repos of the Workspace, not contexts. Links resolve once `npm run sandcastle -- setup` has linked the clone.

  - [<name>](./.sandcastle/repos/<name>/source/GLOSSARY.md) — <one line: what the repo is>
  ```

A rerun that only adds repos: add their links to `## Repos`, nothing else of this step. No map yet (the Workspace was the home repo alone): create `GLOSSARY-MAP.md` linking the existing `GLOSSARY.md` as the home repo's context plus `## Repos`, and switch `docs/agents/domain.md` and the `## Agent skills` block to multi-context.

## 4. Factory package

Done-check: `package.json` has `sandcastle-factory` in `devDependencies`, `tsx` installed, and the `sandcastle` script.

- No `package.json`: `npm init -y`, then `"private": true`.
- `sandcastle-factory` absent: install the newest release tag. Present: keep its tag, upgrading is the human's call.

  ```sh
  git ls-remote --tags --refs --sort=-v:refname https://github.com/dredodin/sandcastle-factory.git 'v*' | grep -v -- '-pr\.' | head -n1 | sed 's|.*refs/tags/||'
  npm install --save-dev "git+https://github.com/dredodin/sandcastle-factory.git#<tag>" tsx
  ```

- `package.json` scripts: `"sandcastle": "tsx node_modules/sandcastle-factory/main.mts"`.

## 5. Layout, ignores, deny

Done-check: every path below is in `.gitignore`, and the deny rules are in `.claude/settings.json`.

Read `node_modules/sandcastle-factory/README.md`: its *Home repo layout* is the layout every later step follows, this installed version, not memory.

- `.gitignore`: each path the README lists, plus `.sandcastle/worktrees/` and `node_modules/`.
- `.claude/settings.json`, merged into what is there: `permissions.deny` holds `Read(./.sandcastle/.env)`, `Edit(./.sandcastle/.env)`, `Write(./.sandcastle/.env)`.

## 6. Home repo scripts

Done-check: `.sandcastle/repos/<home>/` has `Containerfile`, `setup.sh`, `verify.sh`, and `verify.sh` passes. `<home>` is the home repo's GitHub name.

Inspect the home repo: its language, package manager, build, typecheck, test and lint commands, CI workflows. Write:

- `Containerfile`: `FROM sandcastle-factory:base` (node 22, git, gh, jq, Claude Code, Copilot CLI; user `agent`, home `/home/agent`) plus each tool `verify.sh` needs. Install user-level tools as `agent`, under `/home/agent`.
- `setup.sh`: `#!/bin/sh`, `set -e`; runs in the sandbox once the worktree is ready, cwd the worktree root: install dependencies.
- `verify.sh`: `#!/bin/sh`, `set -e`; cwd the worktree root: the repo's real checks, the ones CI runs. Agents run it before every commit; red means no commit.

Each file opens with a one-line comment saying what it is for. Run `bash .sandcastle/repos/<home>/verify.sh` from the repo root; red → fix the script or ask the human whether the repo itself is broken, until green.

## 7. Label

Done-check: `gh label list --search ready-for-agent` shows it.

```sh
gh label create ready-for-agent --description "Ready for the AFK agent"
```

The rest of the triage vocabulary is the home repo's own.

## 8. Setup, by the human

Done-check: `.sandcastle/.env` exists (test its existence only) and every app repo of the Workspace has its `.sandcastle/repos/<name>/source` link.

Stop. The human runs, in their own terminal (Windows: Git Bash, not PowerShell or cmd: setup runs its wizard with `bash`, which there may resolve to WSL):

```sh
npm run sandcastle -- setup
```

Tokens, sandbox engine and clone paths are theirs: never read `.sandcastle/.env`, never ask for a path. Setup warns about Containerfiles still missing; that is expected. Continue once they say it exited 0.

## 9. App repo scripts

Done-check: each app repo's `.sandcastle/repos/<name>/` has `Containerfile`, `setup.sh`, `verify.sh`, and `verify.sh` passes.

Per app repo missing any: inspect the clone through `.sandcastle/repos/<name>/source/`, write the three files as in step 6. The scripts run with cwd the app repo's worktree root, never the home repo's. Check from the home repo root:

```sh
root=$(pwd); (cd .sandcastle/repos/<name>/source && bash "$root/.sandcastle/repos/<name>/verify.sh")
```

Red → fix the script, rerun, until green. Dependencies missing on the clone: it is the human's working copy, so ask before running the install command from `setup.sh` there (never `setup.sh` itself).

## 10. Repo images

Done-check: every repo of the Workspace, home included, has its image, or the engine is none.

Engine: the first of `docker`, `podman` where `<engine> image inspect sandcastle-factory:base` succeeds; neither → none (`SANDBOX=none`), skip this step. A stopped Podman machine fails that inspect too: when `podman machine inspect --format '{{.State}}'` is not `running`, run `podman machine start` before checking.

Image name: `sandcastle:<home>-<name>`, lowercase. File flag: docker `--dockerfile`, podman `--containerfile`. Each missing one:

```sh
npx sandcastle <engine> build-image <file-flag> .sandcastle/repos/<name>/Containerfile --image-name sandcastle:<home>-<name>
```

## Done

Setup exited 0, every verify script passes, every repo image exists or the engine is none. Tell the human the Workspace is ready: `npm run sandcastle -- take <issue>` on an issue labelled `ready-for-agent`.
