---
status: superseded by ADR-0003
---

# ADR-0002: Review the whole branch once per repo

## Context

Reviewing each item right after its implementation saw no whole picture. PR comments became parallel items, so line comments that depend on each other could not be ordered.

## Decision

**Review runs once per touched repo, on its whole integration branch against its default branch, by one review agent. Not per item.**

- Per item: one implement agent; it checks its own piece.
- Plan empty and a branch carries new work: one review agent per such repo, one prompt holding the code review and the doc review: code by the code flow, Markdown by the doc flow, code first. Then the PR phase. Same in `take` and `resume`.
- The review agent commits straight to the integration branch. It sees the run's branches in the other repos, but comments only on its own.

## Consequences

- Cross-item inconsistencies are caught; ordered PR comments work.
- Trade-off: the review agent's own fixes go unreviewed. The human's PR read is the last check.
- A proposal to review per item again re-proposes what this drops.
