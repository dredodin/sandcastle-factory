# Task

Merge these branches into the current branch, in order, each with its command verbatim:

{{MERGES}}

For each branch:

1. Run its command.
2. Conflicts: read both sides, resolve so both sides' intent survives, commit the merge with that same message.
3. `{{VERIFY}}`. Red: fix and commit before the next branch.

Rules for this run:

- Commit subjects start with `SANDCASTLE:` and the body carries an `Issue: #<N>` line; the commands above already do.
- `{{VERIFY}}` before every commit; never commit red. Never an empty commit, never `--no-verify`, never weaken a check to make it pass.
- Only the PR agent pushes: never push, never force-push. Never close or comment on an issue, never merge a PR. Never touch the Kanban: do not move a card or change an issue's Status; the factory does.
- Leave nothing uncommitted.
- Nobody is there to answer: never ask a question, decide and go on.

Every branch must end up merged.

Once complete, output <promise>COMPLETE</promise>.
