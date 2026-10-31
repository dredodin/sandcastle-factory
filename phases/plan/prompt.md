# Task

Plan the next step of root issue #{{ROOT}} in `{{HOME_SLUG}}`. Issues live in this one repo; the work may touch several repos. Integration branch: `{{INTEGRATION_BRANCH}}`, the same name in every repo (the current branch is its copy in `{{HOME_NAME}}`).

Read what you don't already know. Re-check what may have changed since you last looked: each issue's Status and blockers, PR comments, the plan check. Plan from what holds now, never from an earlier plan of yours.

Read, never write, except what Rules 6 and 7 say: you may create issues, add them as sub-issues of the root, label them `repo:<name>`, wire `blockedBy`, reply under PR comments and resolve or minimize them. Never edit files, commit or close an issue. Nobody is there to answer: never ask a question, decide and go on. Never touch the Kanban: do not move a card or change an issue's Status; the factory does.

AFK rules of this run, for you and every agent after you: commit subjects start with `SANDCASTLE:`, the body has `Issue: #<N>`; every commit is preceded by `bash .sandcastle/repos/<repo>/verify.sh` of the repo worked in (its own checks), never committed red; never `--no-verify`, never force-push, never weaken a check to pass; only the PR agent pushes; nobody closes an issue or merges a PR; nothing is left uncommitted. You commit nothing, so you run no verify script.

## Repos

{{REPOS}}

An issue's `repo:<name>` label says which repo its work is done in; no `repo:` label means the home repo. Two `repo:` labels, or an unknown one: the item goes to the home repo. A `repo:` label on a root that has sub-issues routes nothing: each sub-issue goes by its own label.

## Open PRs of this run

{{OPEN_PRS}}

## Read the tree

- Root: `gh issue view {{ROOT}} --repo {{HOME_SLUG}} --json number,title,state,labels,subIssues`
- Each sub-issue, and the root itself when it is the item: `gh issue view <n> --repo {{HOME_SLUG}} --json number,title,state,labels,body,blockedBy,comments`. Its Status (read-only: never change it): `gh api graphql -f query='query { repository(owner: "<owner>", name: "<name>") { issue(number: <n>) { projectItems(first: 20) { nodes { project { number owner { ... on Organization { login } ... on User { login } } } fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } } } } } } }'`, the node whose `project` is number {{KANBAN_NUMBER}} of `{{KANBAN_OWNER}}`

## PR comments

For each open PR listed above, read every kind of comment on it with one GraphQL query (`gh api graphql -f owner=<owner> -f name=<name> -F number=<pr> -f query=...`) over `pullRequest`: `reviewThreads(first: 100)` { `id` `isResolved` `comments(first: 50)` { `url` `body` `createdAt` `author { __typename }` } }, `comments(first: 100)` { `id` `url` `body` `isMinimized` `minimizedReason` `createdAt` `author { __typename }` }, `reviews(first: 100)` { `id` `url` `body` `state` `createdAt` `author { __typename }` }. Page every connection with `pageInfo { hasNextPage endCursor }` until done: no comment left out. No open PR listed: no comments, skip this section.

## Plan check script

When `.sandcastle/repos/{{HOME_NAME}}/plan-check.sh` is in the worktree, run `{{PLAN_CHECK}}` once. Exit 0: no work. Any other exit: what it printed is work, turned into a sub-issue as Rule 6 says. No file: skip this section.

## Rules

1. **Work items**: the root's direct sub-issues. No sub-issues: the root is the single work item. One level only: a sub-issue's own sub-issues are never items.
2. **Candidates**: a sub-issue is a candidate while it is open and its Status is `Ready for agent`. Any other Status (`Backlog`, `Agent working`, `In review`, `Done`) is never planned. A root without sub-issues is the single item while it is open, whatever its Status.
3. **Blocking**: native `blockedBy` is the only signal, blockers outside the tree included. An item is unblocked when every `blockedBy` issue is closed; the factory closes a sub-issue once its work is merged or it ends without code; one it cannot finish goes to Backlog and keeps blocking. A blocker in another repo only orders the work. Never infer blocking from text, overlap or labels.
4. **Labels never decide eligibility**; they only route an item to a repo.
5. **All unblocked candidates**, the issues you created this cycle included (the factory sets them to `Ready for agent` before the plan is used), go into the plan. None: empty plan. Never pick a blocked one as a fallback.
6. **One repo per item, every item an issue.** An item belongs to the repo its label names. Work that is not an issue yet becomes one: create it in `{{HOME_SLUG}}` (`gh issue create`), add it as a sub-issue of the root, label it `repo:<name>` unless it belongs in the home repo, wire `blockedBy` where order matters. The body says what to change and links the PR comments it came from, verbatim where a command is given. PR comments: their issue's label names the repo its work is done in, as the comment shows it (a path, a name, what it asks for); the comment does not show it: the repo of the PR it is on. A comment asking for changes in two repos becomes one issue per repo. As few issues as possible: group by meaning, ideally one, at most four across all repos. Plan check output that fails: one such issue, in the repo its output names, else the home repo, its body saying it comes from the plan check; none while an open sub-issue from the check exists.
7. **PR comments**: every comment is a request to the maintainer's agent.
   - **Own**: a comment whose body starts with the line `{{DISCLAIMER}}` is the agent's own reply, posted under the maintainer's account. Never a request, never work. Every reply you post starts with that line.
   - **Bot**: a comment whose author's `__typename` is `Bot` (CI and the like). Never a request, never work; post nothing under it.
   - **Done**: a review thread that is resolved; a top-level comment minimized with reason `RESOLVED`; a review body (it cannot be minimized) with an own reply that links its URL and says it was moved, won't be done or is answered, and no later comment of the maintainer. Skip them. A moved comment's work is done when every issue it went to is closed.
   - **Pending**: every other comment that is not own, including a re-opened thread or un-hidden comment, even when an own reply is under it. Triage each (nobody is there to answer: never ask it questions). Reply under it: a review thread comment, `gh api repos/<owner>/<name>/pulls/<pr>/comments/<id>/replies -F body=@/tmp/reply.md`; a top-level comment or a review body, `gh pr comment <pr> --repo <owner>/<name> --body-file /tmp/reply.md` (the reply links the review URL). Reply files outside the worktree. Closing a comment: resolve the thread with the `resolveReviewThread` mutation, hide the top-level comment with `minimizeComment`, classifier `RESOLVED`; a review body stays as it is.
     - **Fix**: group into new issues as Rule 6 says, then reply `moved to {{HOME_SLUG}}#<a>, {{HOME_SLUG}}#<b>` (every issue it went to) under each comment, and close it. The new issues go into this cycle's plan.
     - **Won't do**: the reply gives the reason. Close it.
     - **Needs info**: the reply is a question. Leave it open. Not planned. Question and maintainer silent since: leave it; maintainer wrote since: triage again, whole thread.
     - **Already done by a phase**: a request a phase does every run, such as the PR description. Close it silently: no reply, no issue.

## Output

Print the plan as JSON inside `<plan>` tags. `issue` is the issue number as a string, `repo` a repo name from the list above:

<plan>
{"items": [{"issue": "42", "repo": "app", "title": "Fix auth bug"}, {"issue": "43", "repo": "{{HOME_NAME}}", "title": "Rename the flag"}], "created": ["43"]}
</plan>

`created` lists every issue you created this cycle, as strings, whether or not it is in `items`; omit it or leave it empty when you created none. Always print the tags. Nothing to do: `<plan>{"items": []}</plan>`.
