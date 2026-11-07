# sandcastle-factory

- Before every commit: `npm run verify` green. Never `--no-verify`, never weaken a check to make a commit pass.
- Docs and comments: English, extremely concise.
- Nothing here may know a particular home or app repo: repo specifics live in the home repo's `.sandcastle/repos/<name>/`.
- Slow suites are ruled by each repo's own agent instructions file, not by the factory.
- `npm run mutate` is slow: never run it whole. Run one module with `npm run mutate -- --mutate <file>`, only when the task is about that module's surviving mutants.
