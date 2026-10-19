# Coding standards — TypeScript

What `.editorconfig` and `tsconfig.json` cannot enforce.

- Priority order: simplicity → no duplication → explicitness → readability → consistency → minimal change → reuse existing solutions.
- TypeScript: `const` only, readonly data, named exports, `import type`, explicit return types on exported functions, `type` over `interface`, no `any`/`undefined` in owned contracts, mandatory parameters with optional inputs resolved at boundaries. Exception: tests may keep local mutable state to observe effects.
- Guard clauses; no nested `else`.
- Comments only for non-obvious reasons.
- Pure logic in `shared/` (data in → answer out); `git`/`gh`/file calls stay thin one-liners beside it.
- Testing: `node:test` via `tsx --test`, `x.test.mts` beside `x.mts`. Rule: [ADR-0001](docs/adr/0001-the-harness-tests-its-pure-logic.md).
