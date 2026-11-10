# Context

Branch `{{INTEGRATION_BRANCH}}` (the current branch) carries the work of root issue #{{ROOT}} in the repo `{{REPO_NAME}}` ({{REPO_SLUG}}): every item merged in, each reviewed on its own. Review the whole of it against `{{BASE_BRANCH}}`, the fixed point. The work may continue in other repos on the same branch name; their branches, for reference only (you may read them with `gh`, never change them):

{{OTHER_BRANCHES}}

The spec is the root issue, its sub-issues, and the open PR's comments of this branch if any. Issues live in `{{HOME_SLUG}}`:

- Root and sub-issues: `gh issue view {{ROOT}} --repo {{HOME_SLUG}} --json number,title,body,labels,subIssues,comments`.
- PR: `gh pr list --repo {{REPO_SLUG}} --head {{INTEGRATION_BRANCH}} --state open --json number,url`, then `gh api` for the comments and the replies under them.

# Rules for this run

- Nobody is there to answer: never ask a question, decide and go on.
- You only read GitHub: create, link and label no issue, post no comment.
- The plan agent rejected these findings earlier in this run; do not repeat them:

{{REJECTED}}

# Task

Review the whole branch and print what you find.

1. Read the diff: `git diff {{BASE_BRANCH}}...HEAD` and the commit list `git log {{BASE_BRANCH}}..HEAD --oneline`. Code in it (source, scripts, config, tests) → the **code review** below. Markdown in it → the **doc review** below. Both → code first.
2. Deep verify script, when its file is in the worktree: `{{DEEP_VERIFY}}`, once, now. It is slow. What it reports about lines this branch added is a finding; about pre-existing code, a Review note when a diff line triggers it, else nothing.
3. Print the Review report of repo `{{REPO_NAME}}`: two parts, kept apart, each inside its own tags. Nothing in a part: empty tags. Always print both.
   - `<review>`: the **findings**, each with file, axis, what is wrong and how to fix it. They become work.
   - `<review-notes>`: the **Review notes**, one per line as `- <file>:<line> — <what and the recommendation>`, `<file>:<line>` the diff line that triggers it, not necessarily the line to change. They never become work: a human reads them on the PR.

**Minimal**: the diff is the smallest one the task needs; a nearby improvement is separate work. The review enforces it and files nothing the rule excludes under findings:

- **Finding**: a breach of a documented standard in lines this branch added; Spec (a) and (c); Spec (b).
- **Review note**: a smell judgement call on a line this branch added; a breach of a documented standard in pre-existing code that a line of this branch triggers (repeats it, builds on it), recommending to fix it as separate work. No triggering diff line: no note.
- **Neither**: smells in pre-existing code.

## Code review

Two axes, kept apart: a change can pass one and fail the other. Report each separately and do not rerank across them.

**Standards**: does the code conform to the repo's documented standards (`CODING_STANDARDS.md`, `CONTRIBUTING.md`, ADRs, anything that says how code is written), plus `.sandcastle/repos/{{REPO_NAME}}/CODING_STANDARDS.md` when present (it wins on conflict)? Report every breach in lines this branch added, citing the standard (file and rule). A breach in pre-existing code is a Review note when a line of this branch triggers it, else nothing. Then the smell baseline on the lines this branch added: always a judgement call, so every smell is a Review note, and a documented repo standard overrides it. Skip what tooling enforces. Each smell is *what it is* → *how to fix*:

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

**Spec**: does the code do what the root issue and sub-issues asked: (a) requirements missing or partial; (b) anything in the diff no spec line asked for, behaviour or edit (refactor, test move, rename, code moved): scope creep, the fix is to revert it, and an edit a documented repo standard required is not unasked; (c) requirements that look implemented but are wrong. Quote the spec line for each.

## Doc review

Two axes, kept apart.

**Convention**: does the Markdown agree with the rest of the repo? Check its terms against the glossary, its claims against ADRs and format docs, that each fact lives in one file, that paths, links and commands resolve, and that it follows the repo's writing style. When the diff has code, also find the docs that describe the changed code and say what is now wrong. A hard breach is a finding; a judgement call is a Review note. A doc that describes code this branch changed and is now wrong is a finding: the branch broke it. Only a breach that was already there before the branch is a Review note when a diff line triggers it, else nothing.

**Spec**: (a) asked for, missing or partial; (b) in the diff, not asked for, edits included, the fix being to revert; (c) done, but wrong. Quote the spec line for each.

Once complete, output <promise>COMPLETE</promise>.
