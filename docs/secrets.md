# Secrets

All secrets live in `.sandcastle/.env`, one file per machine. The setup wizard writes it; nothing else should. Which keys exist: [`shared/env.mts`](../shared/env.mts).

## GitHub token

`GH_TOKEN`: one fine-grained token covering every repo of the Workspace.

| Permission | Access |
| --- | --- |
| Issues | read/write |
| Contents | read/write |
| Pull requests | read/write |
| Metadata | read |

Sandboxes run `gh auth setup-git`, so `git` pushes with it too. With `SANDBOX=none` that sets your host's global git credential helper.

## Keep agents out of `.env`

Agents never need `.env`. Deny them reading and writing it. Claude Code: `permissions.deny` in `.claude/settings.json`:

```json
{ "permissions": { "deny": ["Read(./.sandcastle/.env)", "Edit(./.sandcastle/.env)", "Write(./.sandcastle/.env)"] } }
```
