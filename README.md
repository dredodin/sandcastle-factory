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
    └── source                       # link to an app repo's clone; setup makes it
```

- `.gitignore`: `.sandcastle/.env`, `.sandcastle/repos/*/source`, `.sandcastle/logs/`.
- Tracker rule: whoever slices an issue sets its repo label.
- `GH_TOKEN`: one fine-grained token for every repo: Issues, Contents, Pull requests read/write; Metadata read.

## Commands

```text
npm run sandcastle -- setup            # asks for missing .env values, links app repos, creates repo labels
npm run sandcastle -- take <issue>     # setup, then a new take
npm run sandcastle -- resume <issue>   # setup, then finishes the open take in every repo
```

## Repo image

```sh
podman build -t sandcastle-factory:base --build-arg AGENT_UID=$(id -u) --build-arg AGENT_GID=$(id -g) node_modules/sandcastle-factory
npx sandcastle podman build-image --containerfile .sandcastle/repos/<name>/Containerfile --image-name sandcastle:<home>-<name>
```

`docker` for `SANDBOX=docker`. Rebuild after every Containerfile edit.

## Develop

`npm run verify`: typecheck, then tests. `npm run mutate`: mutation testing, Linux only. Standards: [CODING_STANDARDS.md](CODING_STANDARDS.md). Decisions: [docs/adr](docs/adr).

## Release

1. Merge to main, `npm run verify` green.
2. `npm version X.Y.Z && git push --follow-tags`; notes in the GitHub Release.
3. `0.x`: a breaking change bumps the minor.
