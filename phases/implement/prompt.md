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
- Cannot finish: leave nothing uncommitted.

# Procedure

1. Write the work, test first where there is a seam.
2. Review it: launch fresh-context subagents in parallel on `git diff <start commit>`, each reporting alone.
   - **Standards**, if the diff has code: the repo's documented standards, `.sandcastle/repos/{{REPO_NAME}}/CODING_STANDARDS.md` when present (wins on conflict), and code smells as judgement calls.
   - **Docs**, if the diff has code or Markdown: the changed Markdown, and docs that describe the changed code and are now wrong.
   - **Spec**, always: anything missing, extra or wrong, quoting the spec line.
3. Fix every finding, except one that contradicts the issue or an ADR: name it in the commit body.
4. `{{VERIFY}}`, commit.

# Outcome

End by printing one outcome as JSON inside `<outcome>` tags. The factory reads it, comments the note on #{{ISSUE}} and moves the card.

- `committed`: the work is committed (the default). No note needed.
- `done without code`: the work needs no commit (a measurement, a manual check). Note: the result.
- `already done`: the issue's criteria already hold on this branch. No review, no commit. Note: the commit that did it.
- `findings rejected`: a review-filed issue whose every finding you reject (it contradicts the issue or an ADR). Note: the reason.
- `cannot finish`: blocked or failed; never for work that is merely hard. Note: what was done and what stopped you.

<outcome>
{"outcome": "committed", "note": ""}
</outcome>

After the outcome, whichever it is, print:

<promise>COMPLETE</promise>
