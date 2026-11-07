---
status: accepted
---

# ADR-0009: A run claims its root through a named pipe per root

## Context

[ADR-0007](0007-the-kanban-status-is-the-run-state.md) promises a run refuses to start twice on one root. The Status cannot tell a crashed run from a live one, and its read and write are separate calls. A second run sweeps the live run's sub-issues back to Ready for agent.

## Decision

**Before any Kanban read-for-write or card move, a run listens on the named pipe of its root and holds it for its whole life.** Holding the name is the whole claim.

- The name is exact, built from repo `owner/name` and root number: a Windows named pipe (`\\.\pipe\sandcastle-factory-…`), a Unix domain socket in `/tmp/sandcastle-factory/` on Linux and macOS (path kept under the macOS limit; longer is an error).
- Listening works: this run holds the root.
- Name taken and a connection is accepted: a live run. Refuse, naming repo#root and, if the holder answers its JSON `{ repo, root, startedAt }` in time, its start time.
- Name taken and the connection is refused (a POSIX socket file a dead process left): remove the file and listen again.
- The OS accepts connections while the run's loop is blocked, so the holder is the main thread: no worker, no server code in a string. If the server fails mid-run, the run logs it with `log.error`.
- The start decision is pure and table-tested (`shared/claim/start-decision.mts`); the I/O is a thin shell (`shared/claim/pipe-claim.mts`).

## Considered and rejected

- A pool of local ports: the pool size caps parallel runs, simultaneous starts need a tie-break, and free is told from foreign only by timing and fetch-error internals.
- A lock ref on GitHub: goes stale on a crash and needs manual cleanup.
- A PID file: a file cannot prove its writer is alive (PIDs are reused); a pipe connection can.
- A port derived from the issue number: collides with unrelated programs.
- One fixed port per machine: blocks parallel roots.
- A long-running server: a process to keep alive.

## Consequences

- A killed process frees the pipe (Windows) or leaves a socket file nobody answers (POSIX): `resume` after a crash just works, with no flag.
- Parallel runs on different roots are unlimited. No setting.
- Runs on two machines are not covered.
- Accepted risk: after a run died, two starts on the same root in the same instant can both clear the socket file and one may unlink the other's live socket; both then run.
- A refused second run has already run `setup` (it comes before the claim), but `setup` only reads the `source` links now (v0.6.0; it once relinked them under the live run), so nothing changes under the live run.
