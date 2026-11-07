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

Any folder of your machine can appear in the sandbox: packages from a private source, ready dependencies, anything. List it in `.sandcastle/repos/<name>/mounts`, one `<host path> -> <sandbox path>` per line (`#` and blank lines skipped). Every sandbox of that repo gets it, read-only; end the line with ` (rw)` to allow writing. With `SANDBOX=none` agents see your folders anyway.

The factory only mounts. Everything else is the repo's: `ENV` in the `Containerfile` (changed it: rebuild the image, as above), or any command in `setup.sh`.

- `(rw)`: what agents write lands on your machine, and all sandboxes of the repo share the folder. Sandboxes run in parallel.
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

### Example: ready `node_modules`

No install: every sandbox reuses one folder. Build it once in the repo's image, on your machine:

```sh
podman run --rm --entrypoint sh -v "$PWD:/repo:ro" -v "<folder>:/out" sandcastle:<home>-<name> -c 'cp /repo/package*.json /out && cd /out && npm ci'
```

`mounts`:

```text
<folder>/node_modules -> /home/agent/deps/node_modules
```

`setup.sh`:

```sh
ln -sfn /home/agent/deps/node_modules node_modules
```

- The sandbox path must end in `node_modules`: Node looks for packages by the real path of the link.
- `.gitignore`: `node_modules`, no trailing slash. `node_modules/` does not match a link.
- Dependencies changed: build the folder again. Read-only, agents cannot add a package.
