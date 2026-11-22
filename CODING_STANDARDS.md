# Coding standards

What `.editorconfig`, `tsconfig.json` and `biome.json` cannot enforce.

## Design

- **Simple.** Each moving part earns its place: name what breaks without it, else cut. Over-engineering is the top finding.
- **Linear.** Code reads top to bottom: a flat loop, state that is the task's own data, decisions on data, log labels only for logs. A fix to a finding reshapes the flow rather than adding state to patch it.
- **Standard first.** Standard pattern, Node API or maintained permissive package over own code.
- **Production-ready.** Code a maintainer ships as is: no hacks or stopgaps, no code in strings, only a library's public API, no failure swallowed.
- **In place.** A change extends the seam of its concern.

## Rules

- Priority order: simplicity → no duplication → explicitness → readability → consistency → minimal change.
- TypeScript: `const` only, readonly data, explicit return types on exported functions, `type` over `interface`, no `undefined` in owned contracts, mandatory parameters with optional inputs resolved at boundaries. Exception: tests may keep local mutable state to observe effects.
- Guard clauses; no nested `else`.
- Comments only for non-obvious reasons.
- Pure logic in `shared/` (data in → answer out); `git`/`gh`/file calls stay thin one-liners beside it.
- Testing: `node:test` via `tsx --test`, `x.test.mts` beside `x.mts`. Rule: [ADR-0001](docs/adr/0001-the-harness-tests-its-pure-logic.md).

## Prompts

`phases/*/prompt.md`: a human reads them too.

- One rule per short bullet; the common case only, edge cases left to the agent.
- Generic words: Workspace terms, no repo's version, tag or preview naming, the factory's own included.
