---
status: accepted
---

# ADR-0004: Who writes what

## Context

Each phase prompt repeated its own "never push, never close, never touch the Kanban" lines. The rule lived in six places and drifted.

## Decision

**The harness changes issues and the Kanban; only the PR phase pushes.**

- Agents never merge a PR, close an issue, comment on an issue or PR, or move a card. The exceptions are the plan phase's issue and PR-comment writes (its prompt, Rules 6 and 7) and the PR phase's push and PR.
- The harness reads an agent's reported result and makes the matching issue and Kanban writes.
- Prompts state goals and what the phase may write, not prohibitions.

## Consequences

- A prompt change that re-adds a prohibition duplicates this ADR.
