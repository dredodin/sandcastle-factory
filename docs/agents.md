# Agents

Each [phase](../GLOSSARY.md) picks its own provider, model and effort, so providers can be mixed. Supported providers and the account each needs: [README](../README.md#requirements-and-limits). The setup wizard asks for the rest; keys and allowed values: [`shared/env.mts`](../shared/env.mts).

## Codex login

Instead of an API key, run `codex login` once on the host. Docker and podman sandboxes mount its login file read-write; `SANDBOX=none` reads it in place. An API key in `.env` wins over the login.

Claude Code hooks do not run under Codex.
