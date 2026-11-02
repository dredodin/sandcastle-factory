---
status: accepted
---

# ADR-0007: The Kanban Status is the state of a run

## Context

An AFK run must show its progress, survive a crash and refuse to start twice on one root issue.

## Decision

**Each issue's Status on the home repo's Kanban is the run state. A pure state machine maps each event to the allowed Status moves.**

- Only the harness moves cards ([ADR-0004](0004-who-writes-what.md)).
- The factory refuses to start unless the Status options are exactly Backlog, Ready for agent, Agent working, In review, Done.
- Built-in workflows on: Item added → Backlog, Item closed → Done, Item reopened → Ready for agent.
- Crash: sub-issues in Agent working go back to Ready for agent; the root issue stays in Agent working.

## Considered and rejected

- Labels as state: a second state beside the Kanban humans read.
- A local state file: invisible to humans and to other machines.

## Consequences

- Humans and the factory see one state; `resume` reads it after a crash.
- Each home repo needs a Kanban with the fixed Status field and three workflows; `GH_TOKEN` needs Project access.
- The factory reads at most 1 000 Kanban items.
