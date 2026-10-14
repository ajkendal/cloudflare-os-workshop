# Troubleshooting

## 1 node or pnpm is missing, or the version is wrong

Attendee: install the tool versions listed in Section 2.1, reopen the terminal, and check node --version and pnpm --version. Do not bypass version checks.

## 2 Vendored Cloudflare OS files are missing

Re-clone the workshop repository into a fresh directory; do not try to initialize a submodule. Then install both workspaces:

```bash
pnpm install
pnpm --dir cloudflare-os install
```

Then rerun `node bootstrap.js`.

## 3 Bootstrap reports existing OAuth or API-token credentials

**Attendee**: stop and ask the speaker for help. Do not paste credentials or automatically run logout. Use a clean workshop environment or remove conflicting credentials only from that environment.

**Runner**: temporary mode rejects normal authentication. Help isolate the workshop or, with the attendee’s explicit approval and only before provisioning, clear the conflicting login. Login/logout afterward clears the temporary cache and can break the configured workshop account.

## 4 “A temporary account is already cached”

**Attendee**: do not repeat the event code through a raw Wrangler command. Ask the speaker whether this is your current workshop account or an unrelated old account.

**Runner**: use the tested resume path for the matching unexpired workshop account, with --temporary and no --event-code. Only clear an unrelated cache after explaining the consequences and obtaining approval.

## 5 The event code is rejected

Re-enter the speaker’s code exactly. If the error says the event has not started, has ended, is disabled, or has no accounts remaining, ask the speaker to check event provisioning. Do not omit the code just to get a standard temporary account.

## 6 Terms acceptance was declined or the bootstrap deployment failed

Read the terminal error. If you declined the terms, provisioning cannot continue. If the network failed, restore connectivity and rerun bootstrap using its recovery checks; it may have created an account before the deployment failed. Do not assume another event-code run is safe.

## 7 Bootstrap cannot find the account ID or workers.dev subdomain

**Attendee**: stop and share only the redacted error with the speaker. Do not run whoami, claim early, or share the Wrangler cache file.

**Runner**: check the pinned Wrangler’s actual global cache path/format and expiry. Query the subdomain API using temporary credentials privately. If necessary, take the subdomain from the bootstrap Worker’s returned URL; never derive it from the account name. Fix the helper rather than asking every attendee to edit configuration.

## 8 Deployment reports missing Access issuer/audience or shows an Access login

**Attendee**: verify you cloned cloudflare-os-workshop at the tested workshop tag.

**Runner**: fix Access-only validation, remove CF_ACCESS_ISS/CF_ACCESS_AUD, and rebuild the frontend with VITE_CF_ACCESS_MODE=false. Deploy both the backend and router assets. Do not use dummy Access settings.

## 9 Account mismatch or temporary account expired

Stop deploying. Do not manually change just the account ID. Ask the speaker to use the fresh-start recovery flow if the event permits another account. Rerun bootstrap so both accountId and publicBaseUrl are regenerated. Resources from the old account are not moved automatically.

## 10 Deployment fails partway through

Keep the temporary cache intact. Resolve the reported error, then rerun pnpm deploy while the same account remains valid. Do not add the event code, run login/logout, or claim the account to fix a partial deploy.

## 11 /admin is denied

Sign in with the exact username shown by bootstrap, not the email address supplied to bootstrap. A valid username begins with a lowercase letter and contains only lowercase letters, digits, and underscores. First signup does not grant admin rights automatically. The runner should confirm that generated ADMINS matches the normalized signed-in username. Do not turn off authorization as a workaround.

## 12 Password signup fails or the username is already taken

If you entered an email address, use the username bootstrap displayed instead; for `fizzyinthehall@gmail.com`, that is `fizzyinthehall`. If you already created the user, use sign-in. If you have not, ask the runner to inspect signup availability and the account state privately. Do not choose a different username without updating the administrator configuration.

## 13 Site URL or redirects are wrong

The router origin must be `https://<router-name>.<actual-subdomain>.workers.dev`, with no path or trailing slash. It must not use connect-bootstrap as the router name. The runner should repair configuration and redeploy before creating Context collections.

## 14 AI chat, storage, exports, or scheduled tasks fail

Ask the speaker to verify the exact failing service and operation is enabled for the event account. Check Workers AI/AI Gateway for model calls, R2/KV for storage, Browser Rendering for exports, and the relevant Worker/bindings for scheduled tasks. Do not claim the account early to try to unlock a service.

## 15 You claimed the account during the session

Tell the speaker. Claiming removes special event entitlements and changes authentication/deployment behavior. The runner must choose between enabling required services on the permanent account or restarting on a new temporary account if the event permits it. Continuing may require billing, including R2 activation.

## 16 Before sharing diagnostics

Share only the error text, tool versions, and redacted configuration.
Never share the temporary API token, full Wrangler cache, passwords, or claim URL.
Anyone with the claim URL can claim the account. Keep it private and exclude it from screenshots, support logs, and repository commits.
