# Home repo layout

What the factory reads from the [home repo](../GLOSSARY.md). `/onboarding-factory` and `setup` create most of it.

```text
GLOSSARY-MAP.md            # optional; docs only, the factory never reads it
.sandcastle/
├── .env                   # per machine, holds the tokens, models, sandbox and Kanban; the setup wizard writes it
├── logs/                  # one folder per run
├── stats.json             # per machine, recent phase and setup.sh durations; the factory writes it
├── worktrees/             # sandbox worktrees; the factory makes them
└── repos/<name>/          # one folder per repo of the Workspace, home repo included; the folders are the repo list
    ├── Containerfile      # the repo image
    ├── setup.sh           # runs in the sandbox once the worktree is ready
    ├── verify.sh          # agents run it before every commit
    ├── sparse-checkout    # optional; what sandbox worktrees check out (git non-cone patterns)
    ├── mounts             # optional; host folders the sandbox sees, `<host path> -> <sandbox path>` per line, ` (rw)` at the end to allow writing
    ├── deep-verify.sh     # optional; slow check, run once per review pass, base branch as $1
    ├── CODING_STANDARDS.md  # optional; your standards, copied into every worktree; reviewers read them on top of the repo's own; yours win on conflict
    ├── plan-check.sh      # optional, home repo only; the plan agent runs it each cycle; non-zero exit = its output becomes work
    └── source             # app repos only; link to the clone, onboarding makes it
```

A repo is in the Workspace when it has a folder under `.sandcastle/repos/`. `setup`, `take` and `resume` fail on an app repo whose `source` link is missing or no git clone.

`.gitignore`:

```text
.sandcastle/.env
.sandcastle/repos/*/source
.sandcastle/logs/
.sandcastle/stats.json
.sandcastle/worktrees/
```

Issues: whoever slices an issue into sub-issues sets each one's [repo label](../GLOSSARY.md).
