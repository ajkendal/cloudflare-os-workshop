# Cloudflare OS Workshop

This is a copy of the [Cloudflare OS Starter Repository](https://github.com/cloudflare/cloudflare-os-starter) modified for use with temporary accounts, so it can be used at Cloudflare Connect 2026.  Do not use this repository for deploying your own permanent Cloudflare OS service.

Review [BUILD-WORKSHOP.md](./BUILD-WORKSHOP.md) for details on how to build this workshop repository from scratch.

## Attendee: Deploy your Cloudflare OS instance

Use these steps once you have learned the Event Code from the speaker.

## Check your laptop

* Install Git, Node.js 24.19 or newer, and pnpm 11.17 or newer.
  * Windows, use [WinGet](https://learn.microsoft.com/en-us/windows/package-manager/winget/)
  * Mac, use [Homebrew](https://brew.sh/)
* Connect to the conference wifi and open a terminal.
* Keep the speaker's event code ready.
* No AI coding tool, custom domain, or Cloudflare Access setup is required.
* **DO NOT SIGN IN TO WRANGLER OR CLAIM THE TEMPORARY ACCOUNT DURING THE WORKSHOP**.

## Clone and install

Open your terminal and change to a temporary directory, then run:

```bash
git clone https://github.com/cloudflare/cloudflare-os-workshop.git
cd cloudflare-os-workshop
```

Open Visual Studio Code and switch to the DevContainer (if possible).  If not possible, then
ensure you are logged out of wrangler, cf, and do not have a CLOUDFLARE_API_TOKEN set.

## Run setup

If using a DevContainer, proceed in a terminal within the DevContainer.  If not, then proceed
in your normal terminal.

```bash
pnpm install
pnpm --dir cloudflare-os install
```

Wait for both installs to finish before continuing.

```bash
node bootstrap.js
```

1. Enter the event code from the speaker
2. Enter your email address. The script derives and displays your Cloudflare OS username from its local part (for example, `mypersonalaccount@gmail.com` becomes `mypersonalaccount`).
3. Review Cloudflare's Terms of Service and Privacy Policy. Type 'yes' if you agree.
4. Wait for the bootstrap deployment and automatic configuration to complete.
5. Save your site URL, administrator username, account expiry, and private claim link. Your username is not an email address: it starts with a lowercase letter and contains only lowercase letters, digits, and underscores. Do not share the claim link or claim the account yet.

**Checkpoint**: the terminal displays "Workshop configuration ready" and tells you to run `pnpm deploy`.  Review `deployment.jsonc` - you should not need to edit this file.

## Deploy Cloudflare OS

```bash
pnpm deploy
```

Wait for all Workers to finish deploying.  The command automatically uses your temporary account.

**Checkpoint**: the final site URL matches the URL printed by bootstrap.  Open that URL in your browser.

## Create your Cloudflare OS login

1. Your site opens on a **Sign in** form, but you have no account yet. Click **Create one** below the Sign in button (or open `/signup`). Signing in first fails with "Invalid username or password".
2. Use the exact username shown by bootstrap and choose a unique password. It is not your email address. This is a Cloudflare OS login, not a Cloudflare account claim.
3. Open `/admin`.  Confirm you can access it.
4. Close new signups if you do not need other users. Register your administrator username before sharing the site URL.
5. Set the site name, logo, and accent color.  No redeploy is needed for branding.

## Verify your instance

1. Start a chat with the default **GLM 4.7 Flash** model and ask "Reply with Workshop ready." Confirm the agent responds.
2. Optionally switch to **Gemma 4 26B** after the speaker has confirmed it is available for the event account.
3. Ask it to build a simple checklist gadget, then refresh and confirm the gadget still exists.
4. Enable and test the context, scheduler, or other integrations the speaker asks you to use.

## Finish the workshop

**Wait until the session ends before claiming your account**.  To keep your Cloudflare account and deployment, open your saved private claim link and finish claiming before its printed deadline.  Claiming removes event-specific entitlements; enable the required services and billing before expecting all features to continue working.

If you do not claim, the temporary account and its resources expire automatically.  After claiming, the workshop's temporary-only deployment wrapper is no longer the right redeploy path: follow the cloudflare-os-starter repository instructions, authenticate normally, and remove temporary mode.

**We recommend starting afresh with the cloudflare-os-starter after claiming your account**.

If you run into problems, review the [Troubleshooting Guide](./TROUBLESHOOTING.md).

## Workshop support and release status

This guide supports Node.js 24.19+ and pnpm 11.17+ with Wrangler 4.144.0, pinned in the repository. `bootstrap.js` checks these prerequisites and prints the account ID, site URL, administrator username, and the event account's actual expiry. The claim link is a private bearer credential: keep it only in your terminal/private notes, never share it, and wait until the session ends before claiming.

The event organizer must separately rehearse the current event code and temporary-account entitlements before publishing a `workshop-v1` release tag. This checkout has not been tagged or published by this preparation workflow.
