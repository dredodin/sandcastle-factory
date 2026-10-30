# Repo image

Each repo's agents run in their own [repo image](../GLOSSARY.md), built from `.sandcastle/repos/<name>/Containerfile`. Start it `FROM sandcastle-factory:base`, then add whatever that repo's `verify.sh` needs.

## Build

`setup` shows the build command of every missing image and runs it on your yes. A repo without a Containerfile is named and skipped, but a run needs every image.

## Rebuild after a Containerfile edit

Remove the old image, then run setup again (`<home>` and `<name>` lowercase):

```sh
<podman|docker> rmi sandcastle:<home>-<name>
npm run sandcastle -- setup
```

`SANDBOX=none` builds no images.
