# Known issues

Failures of any home repo, by a phrase of the failure. Home-repo specifics never go here.

| Failure says | Fix | Then |
| --- | --- | --- |
| `Podman Machine is not running` | `podman machine start` | `resume <issue>` |
| `Command failed: gh …`, no other reason | `gh auth status` passes, else stop | `resume <issue>` |
| `already has an open take PR` | none | `resume <issue>` |
| `<name>: no source link — run onboarding`, or `<name>: source link is not a git clone` | Ask the human; link the clone as onboarding step 2 does (look in the home repo's sibling folders, confirm, `mklink /J` on Windows, else `ln -s`); never clone. Frequent: a repo added on another machine | `resume <issue>` |
| `Nothing to resume for #<issue>: no take branch` | none | `take <issue>` |
