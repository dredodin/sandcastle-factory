---
status: accepted
---

# ADR-0009: A run claims its root through a named pipe

## Context

[ADR-0007](0007-the-kanban-status-is-the-run-state.md) promises a run refuses to start twice on one root. The Status cannot tell a crashed run from a live one, and its read and write are separate calls. A second run sweeps the live run's sub-issues back to Ready for agent.

## Decision

**Before any Kanban read-for-write or card move, a run listens on a named pipe of its root and holds it for its whole life.**

- One pipe per repo and root: `\\.\pipe\sandcastle-factory-<repo>-<root>` on Windows (repo URL-encoded), a `.sock` file in the temp directory elsewhere.
- Listening is atomic: of two simultaneous starts on one root, exactly one gets the pipe.
- A connection to a held pipe is answered with JSON `{ repo, root, startedAt }`. A live run: refuse, naming it. A holder that does not answer so: refuse.
- A socket file whose connection is refused is left by a killed run: the next start removes it. Two starts racing over such a stale file can both win; accepted.
- The decision is pure (`shared/claim/decision.mts`, table-tested); the pipe is a thin shell (`shared/claim/pipe.mts`).

## Considered and rejected

- A local port pool: a setting to maintain, a pool size limiting parallel roots, a tie-break for simultaneous starts.
- A lock ref on GitHub: goes stale on a crash and needs manual cleanup.
- A PID file: disk state that goes stale.
- A port derived from the issue number: collides with unrelated programs.
- One fixed port per machine: blocks parallel roots.
- A long-running server: a process to keep alive.

## Consequences

- A killed process frees its pipe: `resume` after a crash just works, with no flag.
- Parallel runs on different roots work, with no limit and no setting.
- Runs on two machines are not covered.
