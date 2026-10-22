# Next cycle

The last cycle's plan was implemented and merged. Plan the next cycle of root issue #{{ROOT}}: same task, rules and repos as your last plan. What you read then stands; read again only what may have changed.

## On the run's branches now

{{STATE}}

## Read again

- Each candidate you still know of, and each issue blocking one: `state` and `blockedBy` only. An item listed as merged above is no longer a candidate.
- Open PRs of this run, if any: only comments posted since your last plan, and own replies you left awaiting an answer.
- Plan check script: when `.sandcastle/repos/{{HOME_NAME}}/plan-check.sh` is in the worktree, run `{{PLAN_CHECK}}` once, as before.

## Output

The same `<plan>` JSON as before, same schema. Nothing to do: `<plan>{"defaults": [], "items": []}</plan>`.
