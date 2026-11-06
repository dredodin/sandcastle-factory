# Repo image

Agents work inside a container. Each repo gets its own container image, so its agents have the tools that repo's checks need.

- **Recipe**: `.sandcastle/repos/<name>/Containerfile`. Start from `FROM sandcastle-factory:base`, add what `verify.sh` needs.
- **Build**: `setup` builds missing images after asking you.
- **Changed the Containerfile?** Delete the old image, then run setup again:

  ```sh
  docker rmi sandcastle:<home>-<name>   # or podman; names lowercase
  npm run sandcastle -- setup
  ```

With `SANDBOX=none` there are no images.

## Packages the sandbox cannot download

A private feed needs credentials the sandbox does not have. Mount the folder where your machine already holds the packages, read-only: list it in `.sandcastle/repos/<name>/mounts`, one `<host path> -> <sandbox path>` per line (`#` and blank lines skipped). Every sandbox of that repo gets it. With `SANDBOX=none` agents see your folders anyway.

Example, .NET with a private NuGet feed:

`mounts`:

```text
~/.nuget/packages -> /home/agent/nuget-packages
```

`Containerfile`:

```dockerfile
ENV NUGET_FALLBACK_PACKAGES=/home/agent/nuget-packages
ENV NuGetAudit=false
```

`setup.sh`: plain `dotnet restore`.

Gotchas:

- Mount outside `~/.nuget/`: a mount there makes it root-owned and NuGet fails with `Failed to read NuGet.Config due to unauthorized access`.
- `NuGetAudit=false`: the vulnerability audit calls the sources and fails the restore (`NU1900`) under `TreatWarningsAsErrors`.
- The folder must be a restored cache (`<id>/<version>/…`), not bare `.nupkg` files. To hold only one app's packages, run on the host: `dotnet restore --packages <folder>`.
- A package missing from the folder (say a new version an agent adds) sends NuGet to the feed and the restore fails. Restore on the host, then run again.
- Changed the `Containerfile`: rebuild the image, as above.
