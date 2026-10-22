# sandcastle-factory

AFK orchestrator over [`@ai-hero/sandcastle`](https://github.com/ai-hero-dev/sandcastle) (pinned `0.12.0`). `take <issue>`: plan → implement in parallel → merge → review → PR, in sandboxes, nobody asked mid-run. One PR per touched repo. Terms: [GLOSSARY.md](GLOSSARY.md).

## Prerequisites

- Node 22+, git, `gh` (logged in); Windows: git bash
- docker or podman, unless `SANDBOX=none`; with `none`, each repo's toolchain on the host and agents run with all your rights
- GitHub only. Home repo: issues enabled, `GLOSSARY-MAP.md`

## Install

In the home repo, by tag:

```sh
npm install --save-dev "git+https://github.com/<owner>/sandcastle-factory.git#v0.1.0"
```

```json
{ "scripts": { "sandcastle": "tsx node_modules/sandcastle-factory/main.mts" } }
```

## Home repo layout

```text
GLOSSARY-MAP.md                      # links .sandcastle/repos/<name>/… name the repos
.sandcastle/
├── .env                             # per machine; keys: shared/env.mts
├── logs/                            # one folder per run
└── repos/<name>/
    ├── Containerfile                # FROM sandcastle-factory:base + what verify.sh needs
    ├── setup.sh                     # runs in the sandbox once the worktree is ready
    ├── verify.sh                    # agents run it before every commit
    ├── deep-verify.sh               # optional; the review agent runs it once per branch, base branch as $1
    ├── plan-check.sh                # optional, home repo only; the plan agent runs it each cycle, non-zero = its output is work
    └── source                       # link to an app repo's clone; setup makes it
```

- `.gitignore`: `.sandcastle/.env`, `.sandcastle/repos/*/source`, `.sandcastle/logs/`.
- Tracker rule: whoever slices an issue sets its repo label.
- `GH_TOKEN`: one fine-grained token for every repo: Issues, Contents, Pull requests read/write; Metadata read.
- Agents never read `.sandcastle/.env`: deny them Read/Edit/Write on it (Claude Code: `permissions.deny` in `.claude/settings.json`).

## Commands

```text
npm run sandcastle -- setup            # setup wizard, then links app repos, creates repo labels
npm run sandcastle -- take <issue>     # setup (wizard only if a value is missing), then a new take
npm run sandcastle -- resume <issue>   # same setup, then finishes the open take in every repo
```

The setup wizard (`workflow/wizard.sh`, from the vendored `wizard` skill) needs a terminal; without one, setup names the missing keys and stops. A shell variable overrides its `.env` key for one run: `PLAN_MODEL=sonnet npm run sandcastle -- take 42`.

## Repo image

The setup wizard shows the build commands of missing images and runs them on your yes. After a Containerfile edit, remove the image (`podman rmi sandcastle:<home>-<name>`) and run `setup`.

## Develop

`npm run verify`: typecheck, then tests. `npm run mutate`: mutation testing, Linux only. Standards: [CODING_STANDARDS.md](CODING_STANDARDS.md). Decisions: [docs/adr](docs/adr).

## Release

Every PR raises `version` in `package.json`; `0.x`: a breaking change bumps the minor. CI (`.github/workflows/release.yml`) does the rest:

- PR push: verify, then prerelease `v<version>-pr.<PR>.<n>`, install command commented on the PR.
- PR closed: its prereleases and their tags deleted.
- Push to main: verify, then Release `v<version>`; fails when that tag exists.
