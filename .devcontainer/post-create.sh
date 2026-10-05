#!/usr/bin/env bash
# Container create step: activate the package-manager version pinned by this checkout.
#
# Do not install workspace dependencies here. A Dev Containers lifecycle command has no
# interactive terminal, so pnpm cannot safely ask permission to replace an existing
# host-platform node_modules tree. The attendee runs both installs interactively instead.
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

echo ""
echo "pnpm is ready. In the integrated terminal, install dependencies interactively:"
echo "  pnpm install"
echo "  pnpm --dir cloudflare-os install"
