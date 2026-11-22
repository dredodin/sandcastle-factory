# Known issues

Failures of any home repo, by a phrase of the failure. Home-repo specifics never go here.

| Failure says | Fix | Then |
| --- | --- | --- |
| `Podman Machine is not running` | `podman machine start` | `resume <issue>` |
| `Command failed: gh …`, no other reason | `gh auth status` passes, else stop | `resume <issue>` |
| `TLS handshake timeout`, `curl 18` or `early EOF` | `git ls-remote origin` from the home repo succeeds (link back), else stop and tell the human the network is down | `resume <issue>` |
| `already has an open take PR` | none | `resume <issue>` |
| `— run onboarding` | Ask the human, link the clone as onboarding step 2 does | `resume <issue>` |
| `Nothing to resume for #<issue>: no take branch` | none | `take <issue>` |
| `Uncommitted changes on …`, `git status` of the named worktree shows only untracked files under `.sandcastle/repos/` (pre-v0.7.1 factory restoring a script the branch deleted) | Delete the file in that worktree, every other kept worktree, and the host checkout | `resume <issue>` |
