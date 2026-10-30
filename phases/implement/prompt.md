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

1. Write the work, test first where there is a seam.
2. Review it: launch fresh-context subagents in parallel on `git diff <start commit>`, each reporting alone.
   - **Standards**, if the diff has code: the repo's documented standards, `.sandcastle/repos/{{REPO_NAME}}/CODING_STANDARDS.md` when present (wins on conflict), and code smells as judgement calls.
   - **Docs**, if the diff has code or Markdown: the changed Markdown, and docs that describe the changed code and are now wrong.
   - **Spec**, always: anything missing, extra or wrong, quoting the spec line.
3. Fix every finding, except one that contradicts the issue or an ADR: name it in the commit body.
4. `{{VERIFY}}`, commit.

Nothing to change because the issue's criteria already hold on this branch: no review, `git commit --allow-empty` instead, subject `SANDCASTLE: Already done: <title>`, body with the `Issue: #{{ISSUE}}` line and the commit that did it. The merge records the issue as done, so it is planned no more. Never for work that is blocked or failed: those follow the cannot-finish rule.

When the work is committed, print:

<promise>COMPLETE</promise>
