# Commands

Run from the home repo; the list: [README](../README.md#everyday-commands). Windows: in Git Bash, not PowerShell or cmd.

## Setup

`setup` opens the setup wizard, then links app repos and creates repo labels. `take` and `resume` run the same setup first and open the wizard only when something is missing.

The wizard needs a terminal. Without one, setup names the missing keys and stops.

## One-run override

A shell variable beats its `.env` key for one run:

```sh
PLAN_MODEL=sonnet npm run sandcastle -- take 42
```
