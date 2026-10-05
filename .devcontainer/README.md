# Cloudflare OS Workshop devcontainer

This devcontainer is a disposable workshop environment. It keeps the host's
Wrangler logins untouched: it does **not** mount the host home directory or
Wrangler configuration, and Dev Containers do not forward arbitrary host
environment variables into the container. The container therefore starts with
an empty Wrangler credential store, as temporary workshop accounts require.

## Start

1. Clone this repository into a **fresh temporary directory** (including the
   `cloudflare-os` submodule):

   ```sh
   git clone --recurse-submodules https://github.com/cloudflare/cloudflare-os-workshop.git
   cd cloudflare-os-workshop
   ```

2. Open that directory in VS Code or another Dev Containers-compatible editor
   and choose **Reopen in Container**. The create step activates the pinned
   Node 24 / pnpm 11.17 toolchain; it intentionally does not install workspace
   dependencies, because pnpm may require confirmation before replacing an
   existing platform-specific `node_modules` tree.
3. In the integrated terminal, install both workspaces interactively:

   ```sh
   pnpm install
   pnpm --dir cloudflare-os install
   ```

4. Run bootstrap:

   ```sh
   node bootstrap.js
   ```

   Enter the speaker's event code and follow the normal workshop guide.

5. After bootstrap completes, deploy with:

   ```sh
   pnpm deploy
   ```

The dev server ports 5173 and 8787 are forwarded for local development. Do
**not** run `wrangler login` in this container: temporary-account mode does not
need it, and login/logout can clear the temporary account cache.

## Isolation and lifecycle

- This definition deliberately uses the standard bind-mounted workspace. Use a
  fresh clone rather than a checkout that already has host-installed
  `node_modules`; Linux container installs and host-platform binaries cannot be
  shared safely.
- The temporary account cache is stored in the container's own `node` user
  home directory. It survives ordinary stop/start cycles, but is lost when you
  rebuild or delete the devcontainer. Before rebuilding after bootstrap, save
  your workshop details and ask the organizer for the appropriate recovery
  path—do not rerun provisioning blindly.
- Deleting the devcontainer removes its workshop credentials only. It never
  changes `~/.wrangler`, API tokens, or Wrangler login information on the host.
