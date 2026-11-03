---
status: accepted
---

# ADR-0009: A run claims its root through a local port pool

## Context

[ADR-0007](0007-the-kanban-status-is-the-run-state.md) promises a run refuses to start twice on one root. The Status cannot tell a crashed run from a live one, and its read and write are separate calls. A second run sweeps the live run's sub-issues back to Ready for agent.

## Decision

**Before any Kanban read-for-write or card move, a run probes a fixed pool of ports on `127.0.0.1` and holds one for its whole life.**

- The pool is `FACTORY_PORTS` (default `29170-29179`, outside the OS ephemeral ranges).
- A held port answers JSON `{ repo, root, startedAt }`; a port that does not answer so is skipped.
- A live run on the same repo and root: refuse, naming it. No free port: refuse, listing the holders.
- After taking a port the run probes again; on a same-root rival the run on the higher port releases and refuses.
- The decisions are pure (`shared/claim.mts`, table-tested); the sockets are a thin shell.

## Considered and rejected

- A lock ref on GitHub: goes stale on a crash and needs manual cleanup.
- A PID file: disk state that goes stale.
- A port derived from the issue number: collides with unrelated programs.
- One fixed port per machine: blocks parallel roots.
- A long-running server: a process to keep alive.

## Consequences

- A killed process frees its port: `resume` after a crash just works, with no flag.
- Parallel runs on different roots work, up to the pool size.
- Runs on two machines are not covered.
