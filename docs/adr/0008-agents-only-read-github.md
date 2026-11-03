---
status: accepted
---

# ADR-0008: Agents only read GitHub

Supersedes the review exception of [ADR-0004](0004-who-writes-what.md) and "findings become one sub-issue per repo" of [ADR-0003](0003-review-finds-implement-fixes.md). Review still finds and never fixes; the change is in how findings travel.

## Context

The review agent created an issue, linked it to the root and labelled it; the harness found it by diffing the root's sub-issues. A forgotten link lost the findings, a wrong label misrouted them. Review issues outlived the take, so a retake did not start clean.

## Decision

**Branch review prints a Review report; the plan turns it into work that exists only inside the run.**

- Review prints `<review>…</review>` per repo, empty when nothing is found. A missing or unreadable tag is a warning, treated as nothing found.
- The harness hands the last pass's reports to the next cycle's plan agent. The plan groups findings into `work` items and lists the findings it rejects, each with a reason. Only the plan rejects.
- The harness keeps an in-memory record of the run: rejected findings and merged items. Nothing is persisted; a resume starts empty and re-reviews.
- Caps stay: 10 cycles, 2 review passes.

## Consequences

- A review cannot lose or misroute findings, and nothing from it outlives the run.
- The review phase's issue exception in ADR-0004 is gone.
