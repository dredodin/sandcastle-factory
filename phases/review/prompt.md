# Context

Branch `{{INTEGRATION_BRANCH}}` (the current branch) carries the work of root issue #{{ROOT}} in the repo `{{REPO_NAME}}` ({{REPO_SLUG}}): every item merged in, none reviewed yet. Review the whole of it against `{{BASE_BRANCH}}`, the fixed point. The work may continue in other repos on the same branch name; their branches, for reference only (you may read them with `gh`, never change them, and comments go only on this repo's PR):

{{OTHER_BRANCHES}}

The spec is the root issue, its sub-issues, and the open PR's comments of this branch if any. Issues live in `{{HOME_SLUG}}`:

- Root and sub-issues: `gh issue view {{ROOT}} --repo {{HOME_SLUG}} --json number,title,body,labels,subIssues,comments`.
- PR: `gh pr list --repo {{REPO_SLUG}} --head {{INTEGRATION_BRANCH}} --state open --json number,url`, then `gh api` for the comments and the replies under them.

# Rules for this run

- Nobody is there to answer: never ask a question, decide and go on.
- Commit subjects start with `SANDCASTLE:`; the body has an `Issue: #{{ROOT}}` line, and a `Comment: <url>` line per PR comment the commit fixes.
- `{{VERIFY}}` before every commit. Red: fix, never commit. Never `--no-verify`. Never weaken, skip or delete a check to make it pass.
- Only the PR agent pushes: never push, never force-push. Never close or comment on an issue, never merge a PR. Leave nothing uncommitted.

# Task

Review and fix the whole branch.

1. Read the diff: `git diff {{BASE_BRANCH}}...HEAD` and the commit list `git log {{BASE_BRANCH}}..HEAD --oneline`. Code in it (source, scripts, config, tests) → the **code review** below. Markdown in it → the **doc review** below. Both → code first.
2. Fix every finding the reviews report, in this session. A finding that contradicts the issue or an ADR is not a fix: leave it, and say why in the commit body.
3. `{{VERIFY}}` before committing. Red: fix, never commit.
4. Commit. The body says what was fixed and which findings were left.

Always commit, `--allow-empty` when nothing else changed: the summary must reach the PR.

## Code review

Two axes, kept apart: a change can pass one and fail the other. Report each separately and do not rerank across them.

**Standards**: does the code conform to the repo's documented standards (`CODING_STANDARDS.md`, `CONTRIBUTING.md`, ADRs, anything that says how code is written)? Report every breach, citing the standard (file and rule). Then the smell baseline, always a judgement call, and a documented repo standard overrides it. Skip what tooling enforces. Each smell is *what it is* → *how to fix*:

- **Mysterious Name**: a name that does not reveal what it does or holds. → rename; if no honest name comes, the design is murky.
- **Duplicated Code**: the same logic shape in more than one place of the change. → extract it, call it from both.
- **Feature Envy**: a method reaching into another object's data more than its own. → move it onto the data it envies.
- **Data Clumps**: the same few fields or params travelling together. → bundle them into one type.
- **Primitive Obsession**: a primitive or string standing in for a domain concept. → give the concept its own small type.
- **Repeated Switches**: the same `switch`/`if`-cascade on the same type recurring. → polymorphism, or one map both sites share.
- **Shotgun Surgery**: one logical change forcing scattered edits across many files. → gather what changes together.
- **Divergent Change**: one module edited for several unrelated reasons. → split so each changes for one reason.
- **Speculative Generality**: abstraction, parameters or hooks for needs the spec does not have. → delete it.
- **Message Chains**: long `a.b().c().d()` navigation the caller should not depend on. → hide the walk behind one method.
- **Middle Man**: a class or function that mostly delegates onward. → cut it, call the target directly.
- **Refused Bequest**: a subclass that ignores most of what it inherits. → composition instead.

**Spec**: does the code do what the root issue and sub-issues asked: (a) requirements missing or partial; (b) behaviour not asked for (scope creep); (c) requirements that look implemented but are wrong. Quote the spec line for each.

## Doc review

Two axes, kept apart.

**Convention**: does the Markdown agree with the rest of the repo? Per file: (a) a term used against the glossary (`GLOSSARY.md` and similar) or one it says to avoid; (b) a statement an ADR or format doc contradicts: quote both, say which looks wrong; (c) a fact also stated in another file (one fact, one home); (d) a path, link or command that no longer resolves: check each; (e) a break of the repo's writing style. Mark hard breaches apart from judgement calls.

**Spec**: (a) asked for, missing or partial; (b) in the diff, not asked for; (c) done, but wrong. Quote the spec line for each.

Once complete, output <promise>COMPLETE</promise>.
