# Coding standards — TypeScript

What `.editorconfig`, `tsconfig.json` and `biome.json` cannot enforce.

## Design

- **Simple.** Each moving part earns its place: name what breaks without it, else cut. Over-engineering is the top finding.
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
