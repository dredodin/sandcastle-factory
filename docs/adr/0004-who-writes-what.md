---
status: accepted
---

# ADR-0004: Who writes what

## Context

Each phase prompt repeated its own "never push, never close, never touch the Kanban" lines. The rule lived in six places and drifted.

## Decision

**The harness changes issues and the Kanban; only the PR phase pushes.**

- Agents never merge a PR, close an issue, comment on an issue or PR, or move a card. The only exception is the PR phase's writes; [ADR-0008](0008-agents-only-read-github.md) lists them and removed the review and plan exceptions; the harness posts the PR-comment replies.
- The harness reads an agent's reported result and makes the matching issue and Kanban writes.
- Prompts state goals and what the phase may write, not prohibitions.

## Consequences

- A prompt change that re-adds a prohibition duplicates this ADR.
