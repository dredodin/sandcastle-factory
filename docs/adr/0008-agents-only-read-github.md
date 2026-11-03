---
status: accepted
---

# ADR-0008: Agents only read GitHub

Supersedes the review and plan exceptions of [ADR-0004](0004-who-writes-what.md) and "findings become one sub-issue per repo" of [ADR-0003](0003-review-finds-implement-fixes.md). Review still finds and never fixes; the change is in how findings travel.

## Context

The review agent created an issue, linked it to the root and labelled it; the harness found it by diffing the root's sub-issues. A forgotten link lost the findings, a wrong label misrouted them. Review issues outlived the take, so a retake did not start clean.

## Decision

**Branch review prints a Review report; the plan turns it into work that exists only inside the run.**

- Agents write nothing to GitHub. The PR phase's push and PR are the only agent writes; every other write (replies, resolves, Kanban, issues) is the harness's.
- Review prints `<review>…</review>` per repo, empty when nothing is found. A missing or unreadable tag is a warning, treated as nothing found.
- The harness hands the last pass's reports to the next cycle's plan agent. The plan groups findings into `work` items and lists the findings it rejects, each with a reason. Only the plan rejects.
- The harness keeps an in-memory record of the run: each pass's reports, rejected findings, handled comments (one entry per comment) and how each item ended. Nothing is persisted; a resume starts empty and re-reviews.
- The PR description gets a review section per repo: per pass, its report, then the findings fixed, rejected with a reason, and left over.
- PR comments are handled the same way: the plan turns them into `work` items and lists each handled comment with its decision (planned, won't do, needs info). Comments stay open until the PR phase pushes; then the harness replies under each ("fixed in <merge commit>", the reason, or the question) and resolves it, needs info excepted. A top-level comment or review body gets a new PR comment that links it; a review body cannot be resolved, so that link marks it done. A retake ignores the old take's comments; a resume re-triages the open ones.
- Caps stay: 10 cycles, 2 review passes.

## Consequences

- A review cannot lose or misroute findings, and nothing from it outlives the run.
- The review and plan exceptions in ADR-0004 are gone: the plan agent writes nothing to GitHub.
- The factory adds no issue to the Kanban, so the built-in workflow Item added → Backlog is no longer needed.
- One reply per handled comment, so a comment a phase already covers (the PR description) gets a `won't do` reply saying so, where it used to be closed silently.
- A comment is tried once per run: when its `work` item ends without merging (cannot finish, merge conflict), it gets no reply, stays open, and is skipped for the rest of the run. Re-planning it would repeat the same end up to the cycle cap; a resume triages it again.
