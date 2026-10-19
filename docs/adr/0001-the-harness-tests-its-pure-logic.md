---
status: accepted
---

# ADR-0001: The harness tests its pure logic

## Context

The factory is a host script. Its output is a pull request a human reads before anything merges. A live run is slow and costly feedback.

## Decision

**The harness tests its pure logic, and `npm run verify` runs the tests**, so agents working on the factory get deterministic feedback before they commit.

Testing rule:

- Test only where a function has several outcomes and the right one is not readable off one line.
- Expected values are literals (`"sandcastle/hub/issue-42-take-3"`), never recomputed the way the code computes them.
- Not tested: what TypeScript or a zod schema already guarantees; a restated regex; full error text. Assert an error was thrown and a key word, not the sentence.
- No fakes of shell, git, gh, agents or podman. Where a decision is tangled with a git/gh call, extract the decision as a pure function (data in → answer out); the call stays a thin one-liner beside it. No other restructuring for tests.
- Runner: built-in `node:test` via `tsx --test`. Tests sit next to the code: `branches.test.mts` beside `branches.mts`.

## Consequences

- A review that proposes dependency injection or fakes to test more of the harness re-proposes what this rule excludes.
- Mutation testing (`npm run mutate`, 100%) checks that the tests would catch a changed decision; it covers only the pure modules.

## History

Inherited from the harness this factory was ported from. There it was first decided the harness carries no tests (the PR was the check, and a fake shell would cost readability). Reversed: agents need deterministic feedback, and each PR gets less human review.
