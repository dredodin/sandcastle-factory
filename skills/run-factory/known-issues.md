# Known issues

Failures of any home repo, by a phrase of the failure. Home-repo specifics never go here.

| Failure says | Fix | Then |
| --- | --- | --- |
| `Podman Machine is not running` | `podman machine start` | `resume <issue>` |
| `Command failed: gh …`, no other reason | `gh auth status` passes, else stop | `resume <issue>` |
| `already has an open take PR` | none | `resume <issue>` |
| `Nothing to resume for #<issue>: no take branch` | none | `take <issue>` |
