---
status: accepted
---

# ADR-0003: Review finds, implement fixes

Supersedes [ADR-0002](0002-review-the-whole-branch-once-per-repo.md).

## Context

ADR-0002's review agent fixed code itself, so its fixes went unreviewed and left no artifact beyond a commit body. The implement agent judged its own work in the context it wrote it in.

## Decision

**Implement writes, then reviews its item with fresh-context subagents and fixes. Branch review only finds.**

- Implement: Standards subagent if the diff has code, Docs if code or Markdown, Spec always; then fixes.
- Branch review runs per touched repo on its whole branch against the default branch, at most two passes per run: pass 1 strict, pass 2 critical only. It commits nothing.
- Its findings, with the deep verify script's output, become one sub-issue of the root per repo, in the home repo, labelled `repo:<name>` unless home. Nothing found: no issue. The next cycles implement it like any item.
- Run: cycles → review 1 → cycles → review 2 → cycles → PR. Cycles that plan nothing after a pass skip the next review. `resume` restarts at pass 1.

## Considered and rejected

- Review fixes code itself (ADR-0002): its fixes go unreviewed.
- Implement and review as two sandboxed agents per item: costly and complex.

## Consequences

- Reviews leave issues as artifacts; every code change is reviewed at item level.
- A run ends after at most two review passes.
- A proposal for review to fix code again re-proposes what this drops.
