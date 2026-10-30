# Contributing

Rules for agents and humans: [AGENTS.md](AGENTS.md). Standards: [CODING_STANDARDS.md](CODING_STANDARDS.md). Decisions: [docs/adr](docs/adr).

## Develop

- `npm run verify`: typecheck, then tests. Green before every commit.
- `npm run mutate`: mutation testing, Linux only.

## Release

Every PR raises `version` in `package.json`. While on `0.x`, a breaking change bumps the minor. CI ([release.yml](.github/workflows/release.yml)) does the rest:

- PR push: verify, then prerelease `v<version>-pr.<PR>.<n>`; the install command is commented on the PR.
- PR closed: its prereleases and their tags are deleted.
- Push to main: verify, then release `v<version>`. Fails when that tag exists.
