# Task

Open the pull request of the run on root issue #{{ROOT}} to `{{DEFAULT_BRANCH}}` in `{{REPO_SLUG}}` (the repo `{{REPO_NAME}}`; issues live in `{{HOME_SLUG}}`). One PR per repo the run touched: this is this repo's.

Head: `{{INTEGRATION_BRANCH}}`. Title: `{{ROOT_TITLE}}`.

Nobody is there to answer: never ask a question, decide and go on.

AFK rules of this run: commit subjects start with `SANDCASTLE:`, the body has `Issue: #<N>`; every commit is preceded by `{{VERIFY}}`, never committed red; never `--no-verify`, never force-push, never weaken a check to pass; only you push, and only the integration branch; nobody closes an issue or merges a PR; nothing is left uncommitted. You commit nothing, so you run no check.

## Commits

!`git log --format='%h %s%n%b' {{BASE_BRANCH}}..HEAD`

## Steps

1. Push: `gh auth setup-git`, then `git push https://github.com/{{REPO_SLUG}}.git HEAD:refs/heads/{{INTEGRATION_BRANCH}}`. Never force, never push anywhere else.
2. Body: write `/tmp/pr-body.md` (outside the worktree) from the template below. It describes the branch as it stands now, whole, not only the latest commits. Skip preambles, keep prose brief, use the repo's own domain terms. End the body with these lines, verbatim:

{{CLOSES}}

3. Existing PR: `gh pr list --repo {{REPO_SLUG}} --head {{INTEGRATION_BRANCH}} --state open --json url`. One found: reuse it, rewriting its body: `gh pr edit <url> --body-file /tmp/pr-body.md`. None: `gh pr create --repo {{REPO_SLUG}} --base {{DEFAULT_BRANCH}} --head {{INTEGRATION_BRANCH}} --title "<title above>" --body-file /tmp/pr-body.md`. Never `--draft`. A later step adds the run's PR list and merge order to the body: leave a block between `<!-- sandcastle-run -->` and `<!-- /sandcastle-run -->` as it is.

4. Comments, only after step 3. Each `Comment: <url>` line in the commits above names a PR comment the branch fixed. For each one with no own reply yet naming the commit that carries its `Comment:` line (a reply naming an older commit does not count: the comment was re-opened):
   - Reply under it, naming the commit that carries the `Comment:` line (short SHA). The reply starts with the line `{{DISCLAIMER}}`.
   - Reply body in `/tmp/reply.md` (outside the worktree). Then close it, by URL fragment:
     - `#discussion_r<id>`: reply `gh api repos/{{REPO_SLUG}}/pulls/<pr>/comments/<id>/replies -F body=@/tmp/reply.md`; resolve its thread (node id from the PR's `reviewThreads` over GraphQL) with `resolveReviewThread`.
     - `#issuecomment-<id>`: reply `gh pr comment <pr> --repo {{REPO_SLUG}} --body-file /tmp/reply.md`; hide with `minimizeComment`, classifier `RESOLVED`, node id from `gh api repos/{{REPO_SLUG}}/issues/comments/<id> --jq .node_id`.
     - `#pullrequestreview-<id>`: cannot be hidden: reply as a top-level PR comment linking the review URL, nothing to close.
   - One reply per fixed comment, even when one commit fixed several. Never reply or close under a comment the commits do not name.

Never merge the PR, never close or comment on an issue, never commit.

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
