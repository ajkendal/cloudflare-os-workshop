#!/usr/bin/env bash
# Container create step: bring the checkout to the state README.md "Clone and install"
# produces, so the attendee's first command is `node bootstrap.js`.
#
# Deliberately does NOT run bootstrap.js: that needs the speaker's event code, provisions a
# real (if temporary) Cloudflare account, and requires accepting Cloudflare's terms. Those
# are the attendee's decisions, not a container build step.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Verifying toolchain"
node --version
# package.json pins packageManager to pnpm@11.17.0. Activating it here selects the exact
# version the workspace expects rather than whatever the image shipped. Do not run
# `corepack enable`: the image already contains its shims, and that command would try to rewrite
# /usr/local/bin as the unprivileged `node` user. Node 24 still bundles Corepack (it was removed
# in Node 25), which is why the image is 24.
corepack prepare --activate
pnpm --version

# bootstrap.js refuses to run without the submodule, and the two installs below need it.
# A devcontainer opened from a clone made without --recurse-submodules has an empty dir here.
if [ ! -f cloudflare-os/package.json ]; then
  echo "==> Initializing the cloudflare-os submodule"
  git submodule update --init --recursive
fi

# Two separate installs, matching README.md. They are genuinely separate workspaces: the
# submodule's packages install against their own lockfile, and pnpm-workspace.yaml documents
# why the catalogs must stay byte-identical across the two.
echo "==> Installing workspace dependencies (1/2: root)"
pnpm install

echo "==> Installing workspace dependencies (2/2: cloudflare-os submodule)"
pnpm --dir cloudflare-os install

echo "==> Setup complete"
