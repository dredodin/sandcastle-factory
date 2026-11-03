---
status: accepted
---

# ADR-0008: Agents only read GitHub

Supersedes the review and plan exceptions of [ADR-0004](0004-who-writes-what.md) and "findings become one sub-issue per repo" of [ADR-0003](0003-review-finds-implement-fixes.md). Review still finds and never fixes; the change is in how findings travel.

## Context

The review agent created an issue, linked it to the root and labelled it; the harness found it by diffing the root's sub-issues. A forgotten link lost the findings, a wrong label misrouted them. Review issues outlived the take, so a retake did not start clean.

## Decision

**Branch review prints a Review report; the plan turns it into work that exists only inside the run.**

- Review prints `<review>…</review>` per repo, empty when nothing is found. A missing or unreadable tag is a warning, treated as nothing found.
- The harness hands the last pass's reports to the next cycle's plan agent. The plan groups findings into `work` items and lists the findings it rejects, each with a reason. Only the plan rejects.
- The harness keeps an in-memory record of the run: rejected findings, handled comments and merged items. Nothing is persisted; a resume starts empty and re-reviews.
- PR comments are handled the same way: the plan turns them into `work` items and lists each handled comment with its decision (planned, won't do, needs info). Comments stay open until the PR phase pushes; then the harness replies under each ("fixed in <commit>", the reason, or the question) and resolves it, needs info excepted. A retake ignores the old take's comments; a resume re-triages the open ones.
- Caps stay: 10 cycles, 2 review passes.

## Consequences

- A review cannot lose or misroute findings, and nothing from it outlives the run.
- The review and plan exceptions in ADR-0004 are gone: the plan agent writes nothing to GitHub.
