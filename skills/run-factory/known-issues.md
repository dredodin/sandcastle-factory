# Known issues

Failures of any home repo, matched by their failure line in `console.log`. One entry: symptom → fix → then. Home-repo specifics never go here.

## Podman machine stopped

- **Symptom:** `Podman Machine is not running`.
- **Fix:** `podman machine start`.
- **Then:** `resume <issue>`.

## GitHub CLI call failed

- **Symptom:** `Command failed: gh …` with no other reason (a network or API blip).
- **Fix:** none; `gh auth status` must pass, else stop and report.
- **Then:** `resume <issue>`.

## Open take PR

- **Symptom:** `already has an open take PR`.
- **Fix:** none.
- **Then:** `resume <issue>`.

## No take to resume

- **Symptom:** `Nothing to resume for #<issue>: no take branch`.
- **Fix:** none.
- **Then:** `take <issue>`.
