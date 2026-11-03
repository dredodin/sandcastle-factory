# Task

Plan the next step of root issue #{{ROOT}} in `{{HOME_SLUG}}`. Issues live in this one repo; the work may touch several repos. Integration branch: `{{INTEGRATION_BRANCH}}`, the same name in every repo (the current branch is its copy in `{{HOME_NAME}}`).

Read what you don't already know. Re-check what may have changed since you last looked: each issue's blockers, PR comments, the plan check. Plan from what holds now, never from an earlier plan of yours.

You only read: you write nothing to GitHub, no issue, reply, resolve or minimize. The harness posts the replies after the push. Nobody is there to answer: never ask a question, decide and go on.

AFK rules of this run, for you and every agent after you: commit subjects start with `SANDCASTLE:`, the body has `Issue: #<N>`; every commit is preceded by `bash .sandcastle/repos/<repo>/verify.sh` of the repo worked in (its own checks), never committed red; never `--no-verify`, never weaken a check to pass; nothing is left uncommitted. You commit nothing, so you run no verify script.

## Repos

{{REPOS}}

An issue's `repo:<name>` label says which repo its work is done in; no `repo:` label means the home repo. Two `repo:` labels, or an unknown one: the item goes to the home repo. A `repo:` label on a root that has sub-issues routes nothing: each sub-issue goes by its own label.

## Ready for agent

The sub-issues you may plan: {{READY}}

## Review reports

Branch review prints one report per repo and creates no issue. The reports of the last pass, empty ones left out:

{{REVIEW_REPORTS}}

Findings rejected so far in this run:

{{REJECTED}}

## Comments handled so far

PR comments you handled earlier in this run (a resume starts empty):

{{HANDLED}}

## Open PRs of this run

{{OPEN_PRS}}

## Read the tree

- Root: `gh issue view {{ROOT}} --repo {{HOME_SLUG}} --json number,title,state,labels,subIssues`
- Each sub-issue, and the root itself when it is the item: `gh issue view <n> --repo {{HOME_SLUG}} --json number,title,state,labels,body,blockedBy,comments`.

## PR comments

For each open PR listed above, read every kind of comment on it with one GraphQL query (`gh api graphql -f owner=<owner> -f name=<name> -F number=<pr> -f query=...`) over `pullRequest`: `reviewThreads(first: 100)` { `id` `isResolved` `comments(first: 50)` { `url` `body` `createdAt` `author { __typename }` } }, `comments(first: 100)` { `id` `url` `body` `isMinimized` `minimizedReason` `createdAt` `author { __typename }` }, `reviews(first: 100)` { `id` `url` `body` `state` `createdAt` `author { __typename }` }. Page every connection with `pageInfo { hasNextPage endCursor }` until done: no comment left out. No open PR listed: no comments, skip this section.

## Plan check script

When `.sandcastle/repos/{{HOME_NAME}}/plan-check.sh` is in the worktree, run `{{PLAN_CHECK}}` once. Exit 0: no work. Any other exit: what it printed is work, planned as one `work` item (Rule 6) in the repo its output names, else the home repo, every cycle until the check passes. It creates no issue. No file: skip this section.

## Rules

1. **Work items**: the root's direct sub-issues. No sub-issues: the root is the single work item. One level only: a sub-issue's own sub-issues are never items.
2. **Candidates**: the open sub-issues listed above. A root without sub-issues is the single item while it is open. A failing plan check, a review finding or a PR comment adds a `work` candidate.
3. **Blocking**: an item is unblocked when all its `blockedBy` issues are closed; you take blocking only from `blockedBy`, blockers outside the tree and in other repos included.
4. **Labels never decide eligibility**; they only route an item to a repo.
5. **All unblocked candidates** go into the plan. None: empty plan.
6. **One repo per item, every item an issue or `work`.** An item belongs to the repo its label names. Work that is not an issue (PR comments, plan check output, review findings) is a `work` item: its text says what to change, with the comments' words verbatim where a command is given. A `work` item names its `source`: `review`, `comment` or `plan check`; never mix sources in one item. PR comments: the repo its work is done in is the one the comment shows (a path, a name, what it asks for); the comment does not show it: the repo of the PR it is on. A comment asking for changes in two repos becomes one item per repo. As few items as possible: group by meaning, ideally one, at most four across all repos.
7. **PR comments**: every comment is a request to the maintainer's agent. You reply to none and close none; list each one you handle in `comments`.
   - **Own**: a comment whose body starts with the line `{{DISCLAIMER}}` is the agent's own reply, posted under the maintainer's account. Never a request, never work.
   - **Bot**: a comment whose author's `__typename` is `Bot` (CI and the like). Never a request, never work.
   - **Done**: a review thread that is resolved; a top-level comment minimized with reason `RESOLVED`; a review body with an own reply that links its URL, and no later comment of the maintainer. Skip them.
   - **Handled**: a comment listed under "Comments handled so far" above. Skip it, even when open, unless the maintainer wrote under it since: then triage it again, whole thread.
   - **Pending**: every other comment that is not own, including a re-opened thread or un-hidden comment, even when an own reply is under it. Triage each (nobody is there to answer: never ask it questions):
     - **Fix**: decision `planned`, with the 1-based position of its item in `items`.
     - **Won't do**: decision `won't do`, `text` is the reason.
     - **Needs info**: decision `needs info`, `text` is the question. Not planned. An own question under it and the maintainer silent since: skip it, it is not pending; the maintainer wrote since: triage again, whole thread.
     - **Already done by a phase**: a request a phase does every run, such as the PR description: `won't do`, `text` says the PR description covers it.
8. **Review reports**: each finding is work or is rejected. Group findings into `work` items as you see fit, as few as possible; the item's `work` carries the findings it covers, verbatim with file and fix. Reject a finding that contradicts the root, a sub-issue or an ADR: list it in `rejected` with the repo whose report it came from and a reason. Never plan a finding already rejected above.

## Output

Print the plan as JSON inside `<plan>` tags. An item has either `issue`, the issue number as a string, or `work`, the task text (review findings, PR comments or failing plan check output, verbatim with file and fix) with its `source`; never both. `repo` is a repo name from the list above:

<plan>
{"items": [{"issue": "42", "repo": "app", "title": "Fix auth bug"}, {"issue": "43", "repo": "{{HOME_NAME}}", "title": "Rename the flag"}, {"work": "plan-check.sh failed: src/a.ts:3 unused import `x`; remove it.", "source": "plan check", "repo": "{{HOME_NAME}}", "title": "Fix the plan check"}], "rejected": [{"repo": "app", "finding": "a.ts: rename x to y", "reason": "contradicts ADR-0004"}], "comments": [{"id": "PRRT_x", "pr": "https://github.com/o/app/pull/5", "url": "https://github.com/o/app/pull/5#discussion_r1", "kind": "thread", "decision": "planned", "item": 3}, {"id": "IC_y", "pr": "https://github.com/o/app/pull/5", "url": "https://github.com/o/app/pull/5#issuecomment-2", "kind": "comment", "decision": "needs info", "text": "Which flag do you mean?"}]}
</plan>

`rejected` lists the review findings you reject, each with `repo`, `finding` and `reason`; omit it when you reject none. `comments` lists the PR comments you handle: `id` is the GraphQL node id, `pr` the PR URL, `url` the comment's own URL (a thread: its first comment's), `kind` is `thread`, `comment` or `review`, `decision` is `planned` (with `item`), `won't do` or `needs info` (with `text`); omit it when you handle none. Always print the tags. Nothing to do: `<plan>{"items": []}</plan>`.
