---
status: accepted
---

# ADR-0006: Issues live in the home repo; a repo label routes them

## Context

One change can touch several repos. Issues in app repos spread the work across several trackers, and the factory needs issue access in each.

## Decision

**Every issue of a run lives in the home repo: spec, tickets, issues from PR comments. The repo label names the repo of the work.**

- No repo label: home repo. Two repo labels, or an unknown name: home repo too.
- Setup creates one `repo:<name>` label per app repo of the Workspace.
- Labels only route. They never decide eligibility; `blockedBy` is the only order.
- Only direct sub-issues of the root issue are items.

## Considered and rejected

- Cross-repo sub-issues in app repos: work spread across trackers, issue access needed in each repo.
- Labels for order or eligibility: `blockedBy` already orders.

## Consequences

- One tracker and one Kanban hold the whole change. App repos need no issue access.
- Commits in app repos refer to home repo issues.
- Whoever slices a spec sets the repo label.
