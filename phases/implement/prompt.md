# Context

## The work

{{WORK}}

Read the issue whole. Issues live in `{{HOME_SLUG}}`; you work in the repo `{{REPO_NAME}}`, the one checked out here: `gh issue view {{ISSUE}} --repo {{HOME_SLUG}} --json number,title,body,labels,comments`. Comments starting `{{DISCLAIMER}}` are the agent's own.

## The root issue

!`gh issue view {{ROOT}} --repo {{HOME_SLUG}} --json number,title,body,comments --jq '{number,title,body,comments: [.comments[].body]}'`

## Other repos of this run

The same change may continue in other repos, on the same branch name. Their branches, for reference only (you cannot edit them from here):

{{OTHER_BRANCHES}}

## Recent Sandcastle commits (last 10)

!`git log --oneline --grep="SANDCASTLE" -10`

# Run conditions

- Task: {{TITLE}}, the work above. It is the only task. The root is context: other sub-issues of it are other runs' work.
- Branch `{{BRANCH}}`. The commit you started from, the fixed point for your review step: !`git rev-parse HEAD`
- Nobody is there to answer: never ask a question, decide and go on. Where a decision is needed, make it, keep it as small as the work allows, and record it in the commit message. Where the work is genuinely under-specified, stop rather than guess wide.
- Run `{{VERIFY}}` before every commit. Red: fix, never commit. Never `--no-verify`. Never weaken, skip or delete a check to make a commit pass: a check that refuses is right until an issue says otherwise.
- Commits: the subject starts with `SANDCASTLE:`. The body has an `Issue: #{{ISSUE}}` line, says what changed and which decisions were made.
- Leave nothing uncommitted: that fails the run.
- Only the PR agent pushes: never push, never force-push. Never close an issue, never merge a PR. Never reply to or close a PR comment: the planner does.
- Cannot finish: leave nothing uncommitted, comment on #{{ISSUE}} what was done and what stopped you: `gh issue comment {{ISSUE}} --repo {{HOME_SLUG}} --body-file /tmp/comment.md` (outside the worktree). Then stop.

# Procedure

1. Write the work. Do not read coding standards or repo docs first. Test first where there is a seam to test: write the failing test, make it pass, repeat. Run typechecking and single test files as you go.
2. Launch reviewer subagents in parallel with your provider's subagent feature (Claude Code's agent tool, Copilot CLI's subagents). Each gets fresh context, the diff since the start commit (`git diff <start commit>`), and reports separately:
   - **Standards**, only when the diff has code: the repo's documented standards (`CODING_STANDARDS.md`, `CONTRIBUTING.md`, ADRs), plus `.sandcastle/repos/{{REPO_NAME}}/CODING_STANDARDS.md` when present (it wins on conflict), plus the smell baseline as judgement calls: mysterious names, duplicated code, feature envy, data clumps, primitive obsession, repeated switches, shotgun surgery, divergent change, speculative generality, message chains, middle men. A documented rule overrides the baseline. Skip what tooling enforces.
   - **Docs**, when the diff has code or Markdown: changed Markdown against the glossary, ADRs, format docs, one fact one home, links, paths and commands that still resolve, the writing style; and docs anywhere in the repo that describe changed code (names, paths, commands, behaviour) and are now wrong.
   - **Spec**, always, once over the whole diff: anything missing or partial, anything added that was not asked, anything done but wrong. Quote the spec line.
3. Fix every finding. A finding that contradicts the issue or an ADR is left and named in the commit body.
4. `{{VERIFY}}`, commit to the current branch.

When the work is committed, print:

<promise>COMPLETE</promise>
