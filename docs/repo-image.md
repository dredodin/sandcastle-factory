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

## Host folders in the sandbox

For what a sandbox cannot get on its own, such as packages from a private source it has no credentials for. Mount the folder where your machine already holds it: list the folder in `.sandcastle/repos/<name>/mounts`, one `<host path> -> <sandbox path>` per line (`#` and blank lines skipped). Every sandbox of that repo gets it, read-only. With `SANDBOX=none` agents see your folders anyway.

- Tell the tool where the folder is, usually with `ENV` in the `Containerfile`. Changed the `Containerfile`: rebuild the image, as above.
- Mount outside any folder the tool writes to: a mount makes its parent folders root-owned, and the tool loses write access there.
- Anything missing from the folder, the sandbox still cannot get. Fetch it on your machine, then run again.
- Agents can read all of the folder. Keep secrets out of it.

### Example: .NET with a private NuGet feed

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

NuGet's own gotchas:

- Mount outside `~/.nuget/`, or NuGet fails with `Failed to read NuGet.Config due to unauthorized access`.
- `NuGetAudit=false`: the vulnerability audit calls the sources and fails the restore (`NU1900`) under `TreatWarningsAsErrors`.
- The folder must be a restored cache (`<id>/<version>/…`), not bare `.nupkg` files. To hold only one app's packages, run on the host: `dotnet restore --packages <folder>`.
- A package missing from the folder, say a new version an agent adds, sends NuGet to the feed and the restore fails with `NU1301`. Run `dotnet restore` on the host.
