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
