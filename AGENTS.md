# sandcastle-factory

- Before every commit: `npm run verify` green. Never `--no-verify`, never weaken a check to make a commit pass.
- Docs and comments: English, extremely concise.
- Nothing here may know a particular home or app repo: repo specifics live in the home repo's `.sandcastle/repos/<name>/`.
- Slow test suites are ruled by each repo's own agent instructions file (`AGENTS.md` or `CLAUDE.md`, never both), not by the factory: prompts name no suite and ban no command. Review fixes name a code change, never a command.
