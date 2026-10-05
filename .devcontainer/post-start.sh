#!/usr/bin/env bash
# Runs on every container start. Two jobs: prove the credential isolation this container
# exists to provide, and tell the attendee which step they are on.
#
# Never fails the start: a warning here should not stop someone opening a terminal.
set -uo pipefail

cd "$(dirname "$0")/.."

echo ""
echo "Cloudflare OS Workshop devcontainer"
echo "-----------------------------------"

# The same four checks bootstrap.js makes before it will provision an account
# (scripts/temporary-account.ts:conflictingCredentialSources). Reporting them here means a
# problem surfaces now, rather than after the attendee has typed the speaker's event code.
conflicts=()
for var in CLOUDFLARE_API_TOKEN CLOUDFLARE_API_KEY CLOUDFLARE_GLOBAL_API_KEY; do
  if [ -n "${!var:-}" ]; then conflicts+=("$var"); fi
done
# Wrangler resolves its global config dir legacy-home-first, so check both locations.
wrangler_dir="$HOME/.wrangler"
if [ ! -d "$wrangler_dir" ]; then wrangler_dir="${XDG_CONFIG_HOME:-$HOME/.config}/.wrangler"; fi
for f in config/default.toml config/default.enc config.toml config.json; do
  if [ -f "$wrangler_dir/$f" ]; then conflicts+=("stored Wrangler credentials ($f)"); fi
done

if [ ${#conflicts[@]} -eq 0 ]; then
  echo "Wrangler credentials: none (correct - the workshop needs a clean environment)"
else
  echo "WARNING: conflicting Wrangler credentials found:"
  printf '  - %s\n' "${conflicts[@]}"
  echo "  bootstrap.js will refuse to run. Ask the workshop organizer before removing anything."
fi

# Surface the temporary account cache if one exists, without printing the API token or the
# claim URL -- TROUBLESHOOTING.md section 16 treats both as bearer credentials.
temp_cache="$wrangler_dir/wrangler-temporary-account.toml"

echo ""
if [ ! -f cloudflare-os/package.json ] || [ ! -d node_modules ]; then
  echo "Next step: bash .devcontainer/post-create.sh   (dependencies are not installed)"
elif [ -f "$temp_cache" ] && [ -f deployment.jsonc ]; then
  echo "A temporary workshop account is configured."
  echo "Next step: pnpm deploy"
  echo ""
  echo "NOTE: this account lives only inside this container. Rebuilding the container"
  echo "      discards it, and it cannot be re-provisioned without a new event code."
else
  echo "Next step: node bootstrap.js   (have the speaker's event code ready)"
fi
echo ""
