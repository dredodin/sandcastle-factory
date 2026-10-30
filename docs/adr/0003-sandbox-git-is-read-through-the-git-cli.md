---
status: accepted
---

# ADR-0003: Sandbox git is read through the `git` CLI

## Context

In a sandbox the `git` CLI works, but libraries that open the repo themselves (libgit2, LibGit2Sharp) fail: Stryker.NET `--since` crashed (dredodin/sundukovich#266). `@ai-hero/sandcastle` 0.12.0 already overlays the worktree's `.git` file with a sandbox path on Windows; the remaining cause is not pinned.

## Decision

**A repo's verify, deep verify and plan check scripts read git through the `git` CLI. The libgit2 failure is left undiagnosed until a script cannot do without libgit2.**

## Consequences

- Diff-based tools get their changed files from `git diff`, passed as arguments.
- Tool modes that open the repo through libgit2 (Stryker.NET `--since`, `--with-baseline`) are out inside a sandbox.
- A script that needs libgit2 reopens this: reproduce in a sandbox first, then fix here or upstream.
