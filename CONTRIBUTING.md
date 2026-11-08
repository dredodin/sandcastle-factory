# Contributing

Rules for agents and humans: [AGENTS.md](AGENTS.md). Standards: [CODING_STANDARDS.md](CODING_STANDARDS.md). Decisions: [docs/adr](docs/adr).

## Develop

- `npm run verify`: lint (`biome.json`), typecheck, then tests. Green before every commit.
- `npm run mutate`: mutation testing, Linux only; slow, see [AGENTS.md](AGENTS.md).

## Release

Every PR raises `version` in `package.json`. SAD snapshots, `docs/releases/v<version>/sad.md`, are the human's: an agent leaves `docs/releases/` as it is, and a PR without one is no finding. While on `0.x`, a breaking change bumps the minor. CI ([release.yml](.github/workflows/release.yml)) does the rest:

- PR push: verify, then prerelease `v<version>-pr.<PR>.<n>`; the install command is commented on the PR.
- PR closed: its prereleases and their tags are deleted.
- Push to main: verify, then release `v<version>`. Fails when that tag exists.
