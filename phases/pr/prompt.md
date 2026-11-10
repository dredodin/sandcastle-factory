# Task

Open the pull request of the run on root issue #{{ROOT}} to `{{DEFAULT_BRANCH}}` in `{{REPO_SLUG}}` (the repo `{{REPO_NAME}}`; issues live in `{{HOME_SLUG}}`). One PR per repo the run touched: this is this repo's.

Head: `{{INTEGRATION_BRANCH}}`. Title: `{{ROOT_TITLE}}`.

Nobody is there to answer: never ask a question, decide and go on.

AFK rules of this run: commit subjects start with `SANDCASTLE:`, the body has `Issue: #<N>`; every commit is preceded by `{{VERIFY}}`, never committed red; never `--no-verify`, never weaken a check to pass; nothing is left uncommitted. You commit nothing, so you run no check.

## Commits

!`git log --format='%h %s%n%b' {{BASE_BRANCH}}..HEAD`

## Steps

1. Push: `git push https://github.com/{{REPO_SLUG}}.git HEAD:refs/heads/{{INTEGRATION_BRANCH}}`. No force.
2. Body: write `/tmp/pr-body.md` (outside the worktree) from the template below. It describes the branch as it stands now, whole, not only the latest commits. Skip preambles, keep prose brief, use the repo's own domain terms. Write no `Closes` line: the PR closes no issue.

3. Existing PR: `gh pr list --repo {{REPO_SLUG}} --head {{INTEGRATION_BRANCH}} --state open --json url`. One found: reuse it, rewriting its body: `gh pr edit <url> --body-file /tmp/pr-body.md`. None: `gh pr create --repo {{REPO_SLUG}} --base {{DEFAULT_BRANCH}} --head {{INTEGRATION_BRANCH}} --title "<title above>" --body-file /tmp/pr-body.md`. Never `--draft`. A later step adds the models, the run's PR list and the review outcome to the body: leave a block between `<!-- sandcastle-run -->` and `<!-- /sandcastle-run -->` as it is.

4. Review notes: the last review pass's notes on this repo, never work, for the maintainer to read:

   {{REVIEW_NOTES}}

   None: skip this step. Otherwise post them as one PR review, event `COMMENT` (never request changes), via `gh api repos/{{REPO_SLUG}}/pulls/<number>/reviews`. One thread per note, anchored to the note's `<file>:<line>` on the PR's diff (`comments` entries with `path`, `line`, `side: RIGHT`), each body starting with this line, then a blank line, then the note:

   {{DISCLAIMER}}

   First read the PR's inline review comments (`gh api repos/{{REPO_SLUG}}/pulls/<number>/comments`) and post no note already there. Then check each note's line against `gh pr diff`: a note whose line is no longer on the RIGHT side of the diff goes into the review body with its `<file>:<line>`, not as a thread, so one stale note cannot make GitHub reject the review. Every note already posted: no review.

## Body template

```markdown
## Summary

<the smallest view that makes the key point clear: pseudocode for logic, a call tree for control flow, a shallow file tree for a refactor, Mermaid for interaction, a diff when only the change matters>

## Evidence

- **Before:** <output / failing test run>
  **After:** <output / passing test run>

## Merge Danger

**Door:** <one-way or two-way>

<optional: description>

**Blast Radius:** <one-word description>

<optional: potential ramifications of merge>
```

Evidence: concrete proof the change works, a before and after. Execution-based evidence (test results, console output; the exact test that now passes, as pseudocode) beats prose. Merge Danger: a one-way door is hard to walk back (destructive or hard-to-reverse); a two-way door is cheap to roll back. The blast radius is the scope of what a merge can break.

## Output

Print the PR URL as JSON inside `<pull-request>` tags:

<pull-request>
{"url": "https://github.com/{{REPO_SLUG}}/pull/1"}
</pull-request>
