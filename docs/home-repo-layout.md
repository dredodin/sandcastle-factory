# Home repo layout

What the factory reads from the [home repo](../GLOSSARY.md). `/onboarding-factory` and `setup` create most of it.

```text
GLOSSARY-MAP.md            # lists the app repos; none: the home repo alone
.sandcastle/
├── .env                   # per machine, holds the tokens and the Kanban; the setup wizard writes it
├── logs/                  # one folder per run
├── worktrees/             # sandbox worktrees; the factory makes them
└── repos/<name>/          # one folder per repo of the Workspace, home repo included
    ├── Containerfile      # the repo image
    ├── setup.sh           # runs in the sandbox once the worktree is ready
    ├── verify.sh          # agents run it before every commit
    ├── sparse-checkout    # optional; what sandbox worktrees check out (git non-cone patterns)
    ├── deep-verify.sh     # optional; slow check, run once per review pass, base branch as $1
    ├── CODING_STANDARDS.md  # optional; your standards, copied into every worktree; reviewers read them on top of the repo's own; yours win on conflict
    ├── plan-check.sh      # optional, home repo only; the plan agent runs it each cycle; non-zero exit = its output becomes work
    └── source             # link to the app repo's clone; setup makes it
```

`GLOSSARY-MAP.md` names a repo by linking a file under `.sandcastle/repos/<name>/`.

`.gitignore`:

```text
.sandcastle/.env
.sandcastle/repos/*/source
.sandcastle/logs/
.sandcastle/worktrees/
```

Issues: whoever slices an issue into sub-issues sets each one's [repo label](../GLOSSARY.md).
