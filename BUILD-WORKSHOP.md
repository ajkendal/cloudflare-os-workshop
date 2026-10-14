# Workshop runner: create cloudflare-os-workshop

## 1.1 Create the repository from the starter

Create an empty repository named `cloudflare-os-workshop` in your chosen GitHub organization. Do not initialize it with another README or license. Replace YOUR-ORG below with that organization.

```bash
git clone --recurse-submodules https://github.com/cloudflare/cloudflare-os-starter.git cloudflare-os-workshop
cd cloudflare-os-workshop
git remote rename origin upstream
git remote add origin https://github.com/YOUR-ORG/cloudflare-os-workshop.git
git switch -c workshop-setup
git rev-parse HEAD
git submodule status
```

Record the starter commit and pinned Cloudflare OS submodule commit in the workshop README. Preserve the starter’s license and notices. Keep the pinned submodule through the starter-specific setup work; vendor it before making workshop-specific Cloudflare OS changes.

## 1.2 Vendor Cloudflare OS for the workshop

The workshop's model catalog differs from the upstream default: temporary Workers Free accounts cannot use the upstream Kimi K2.7 Code or GLM 5.2 defaults. Vendor the pinned submodule before changing that catalog, so every attendee clones one complete repository and the workshop owns its tested Cloudflare OS revision.

```bash
# Preserve the initialized submodule's working tree and its ignored node_modules/ directory.
git submodule deinit -f cloudflare-os
git rm --cached cloudflare-os
rm cloudflare-os/.git
rm -rf .git/modules/cloudflare-os
git rm .gitmodules
git add cloudflare-os
```

Keep `cloudflare-os/` at the same path: the workshop deployment scripts and its two linked workspace packages already use that path. Its own `pnpm-workspace.yaml`, lockfile, and `.gitignore` remain in effect, so it stays a separately installed workspace; vendoring only removes Git submodule setup from an attendee clone. Record the upstream commit used to create the vendored directory, retain its `LICENSE` and notices, and keep workshop changes small enough to reapply if the pinned upstream revision must later change.

In `cloudflare-os/packages/workshop-shared/src/api.ts`, replace the Cloudflare entries in `SUGGESTED_MODELS` with these Workers Free-compatible models, keeping GLM first so it is the default chat model:

```ts
"cloudflare": {
  "@cf/zai-org/glm-4.7-flash": {
    name: "GLM 4.7 Flash (Workers AI)", contextWindow: 131072,
    outputLimit: WORKERS_AI_OUTPUT_LIMIT,
  },
  "@cf/google/gemma-4-26b-a4b-it": {
    name: "Gemma 4 26B (Workers AI)", contextWindow: 256000,
    outputLimit: WORKERS_AI_OUTPUT_LIMIT,
  },
},
```

Remove the Kimi K2.7 Code and GLM 5.2 entries. They require Workers Paid or prepaid AI Gateway credits and otherwise return 403 on Workers Free accounts. Update the compaction test for GLM's `131072 - 32768 = 98304` input-token budget. Validate Gemma on a temporary event account before publishing; GLM 4.7 Flash has already been validated.

After vendoring, update attendee clone commands to omit `--recurse-submodules` and change bootstrap's missing-directory guidance from "submodule is not initialized" to a checkout-integrity error.

## 1.3 Install and pin the toolchain

```bash
node --version
pnpm --version
pnpm install
pnpm --dir cloudflare-os install
pnpm exec wrangler --version
```

* Use Node.js 24.19 or newer and the starter’s pnpm 11.17 toolchain.
* Select and pin one tested Wrangler version, at least 4.144 for event-code support. Align the Wrangler used by bootstrap with the one used for all six deployment invocations, including the vendored Cloudflare OS workspace.
* Update the applicable workspace/catalog entries and lockfiles rather than relying on npx wrangler@latest at the conference.
* Verify the version from every package context where the deployment script resolves Wrangler.

## 1.4 Replace the deployment defaults with workshop defaults

Create a tracked deployment.template.jsonc from the starter’s deployment.jsonc. Preserve the other annotated settings and replace the relevant fields with this target shape:

```json
"accountId": "<SET_BY_BOOTSTRAP>",
"publicBaseUrl": "<SET_BY_BOOTSTRAP>",
"workers": {
  "router": {
    "name": "connect-os",
    "route": { "workersDev": true }
  },
  "workshop": { "name": "connect-os-workshop" },
  "context": { "name": "connect-os-context" },
  "scheduler": { "name": "connect-os-scheduler" },
  "customGatekeeper": { "name": "connect-os-custom" },
  "errorReporter": { "name": "connect-os-errors" }
},
"access": {
  "admins": ["<SET_BY_BOOTSTRAP>"]
}
```

* Remove customDomain. Only the router gets `workersDev: true`. Keep the five backend Workers private, and keep preview URLs disabled.
* Keep all six Worker names distinct and stable. Attendees may reuse these names because each has a separate account.
* Remove Access issuer and audience. Retain access.admins as the administrator allowlist; the field name does not activate Access.
* Replace `customGatekeeper.name` and `customGatekeeper.message` placeholders with “Connect workshop” and workshop-specific guidance.
* Keep the KV namespace IDs, R2 bucket name, and context.sharingDomain as null. Disable Context Artifacts unless the event explicitly provides that capability.
* Keep `aiGateway` enabled with the default gateway, accountId: null, and providers: ["cloudflare"] when those services are entitled for the session.

Have bootstrap generate the local `deployment.jsonc` from this template. Remove the original `deployment.jsonc` from tracking and add it to `.gitignore` so attendee-specific configuration is not committed. Do not add API tokens, event codes, claim URLs, or passwords to either configuration file.

```bash
git rm --cached deployment.jsonc
# Add /deployment.jsonc to .gitignore.
# Commit deployment.template.jsonc as the non-secret workshop template.
```

## 1.5 Enable built-in username/password sign-in

Make these changes in the workshop-owned scripts, following the starter’s [sign-in-method instructions](docs/customization.md#sign-in-methods). This target configuration is not accepted by the unchanged starter.

1. In scripts/deployment-config.ts, change the workshop’s AccessConfig to contain admins only. Remove issuer and audience from this password-only workshop type.
2. In scripts/deploy.ts, remove access.issuer and access.audience from requiredPaths. Remove their issuer URL and audience validation. Retain administrator-list validation. Require lowercase Cloudflare OS usernames: they start with a letter and contain only letters, digits, and underscores; they are not email addresses.
3. In generateConfigs(), keep ADMINS: config.access.admins and PUBLIC_BASE_URL: origin in workshop.vars. Remove CF_ACCESS_ISS and CF_ACCESS_AUD completely; do not substitute dummy values.
4. In buildCommands(), change the frontend build environment from VITE_CF_ACCESS_MODE: "true" to "false". Set false explicitly so a shell environment cannot accidentally enable Access.
5. Leave AUTH_GATEKEEPERS unset/empty and DISABLE_PASSWORD_AUTH unset/false for password-only sign-in.
6. Update tests that assume Access-only validation, generated variables, or frontend build mode.

```js
// Target Workshop variables, before the existing AI Gateway variables are added:
workshop.vars = {
  ADMINS: config.access.admins,
  PUBLIC_BASE_URL: origin,
};

// Target frontend build entry:
{
  args: submoduleBuild("@gadgets/workshop-frontend"),
  env: { VITE_CF_ACCESS_MODE: "false" },
}
```

Derive the attendee’s Cloudflare OS username from the local part of the email collected by bootstrap (for example, `fizzyinthehall@gmail.com` becomes `fizzyinthehall`), then write the derived username to `ADMINS`. Cloudflare OS usernames start with a letter and contain only lowercase letters, digits, and underscores; they are not email addresses. First signup does not automatically grant administrator access. Password sign-in is not email-verified Cloudflare Access identity. Do not advertise this setup as equivalent to an Access-protected production deployment.

## 1.6 Add the bootstrap Worker

Create `bootstrap/worker.mjs`:

```js
export default {
  fetch() {
    return new Response("Workshop account ready");
  }
};
```

Create `bootstrap/wrangler.jsonc`. Use a compatibility date verified with the pinned toolchain. Do not add account_id, custom domains, storage, or service bindings.

```jsonc
{
  "name": "connect-bootstrap",
  "main": "worker.mjs",
  "compatibility_date": "2026-09-30",
  "workers_dev": true,
  "preview_urls": false
}
```

## 1.7 Implement node bootstrap.js

Add `bootstrap.js` at the repository root. The starter uses JavaScript modules, so use Node ESM. Implement the following sequence; this is the script’s required behavior, not an existing upstream command.

1. Check Node, pnpm, the vendored Cloudflare OS files, installed dependencies, and the pinned Wrangler version. Stop with the exact fix if any prerequisite is missing.
2. Prompt for the session event code and the attendee’s email. Trim the code, validate it using the accepted event format, and validate/lowercase the email. Do not prompt for an application password.
3. Check for conflicting environment credentials, stored OAuth credentials, and any temporary-account cache. Never automatically log the attendee out or overwrite an unrelated temporary account. Explain the conflict and stop. Allow a tested resume path for the same valid workshop account without resending its event code.
4. Resolve the pinned local Wrangler entry point and spawn the bootstrap deployment with `pnpm deploy --config bootstrap/wrangler.jsonc --temporary --event-code <entered-code>`. Pass arguments as an array, not an interpolated shell command; support Windows command execution.
5. Use inherited terminal input/output so Wrangler displays the Terms of Service and Privacy Policy and collects acceptance from the attendee. Do not automatically answer yes. Stop if acceptance is declined or Wrangler exits unsuccessfully.
6. Read `wrangler-temporary-account.toml` from the correct global configuration directory for the pinned version. Mirror its legacy-home versus OS/XDG path precedence. Use a TOML parser, not a regular expression over the whole file.
7. Validate account.id, the temporary API token, account expiry, and claim expiry. Copy only the account ID into configuration. Never print or persist the temporary API token outside Wrangler’s private cache.
8. Call `GET https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/subdomain` using the cached token as the Bearer credential. Check HTTP status, success, and a non-empty valid result.subdomain. Do not infer the subdomain from the account’s display name.
9. Derive a valid Cloudflare OS username from the email local part: lowercase it, replace each non-`[a-z0-9_]` character with `_`, and prefix `user_` when it does not begin with a letter. Read `deployment.template.jsonc` with a JSONC-aware parser/editor. Set `accountId`, `workers.router.route = { workersDev: true }`, `publicBaseUrl = https://<router-name>.<subdomain>.workers.dev`, and `access.admins = [<derived-username>]`. Write `deployment.jsonc` atomically only after all required values validate.
10. Print a completion summary containing the account ID, site URL, administrator username, and expiry. Display the claim link only in the attendee’s private interactive terminal, with a warning not to share or claim it until after the session. Do not send it to analytics or shared logs.

Add and lock a TOML-parser dependency and use the starter’s jsonc-parser dependency for configuration edits. Keep cache-resolution logic in a small shared helper used by bootstrap and deployment. Wrangler’s cache format is internal: pin and test the version rather than treating the path and fields as a stable public API.

Make rerunning bootstrap safe. If a valid configured workshop account matches the cache, offer to refresh the configuration using that account and run without `--event-code`. If cache/configuration account IDs differ, stop for an explicit recovery decision. If the account expired, require a deliberate fresh start and regenerate both accountId and publicBaseUrl.

Bootstrap success output:

```text
Workshop configuration ready.
Account ID: <32-character account ID>
Site URL: https://connect-os.<subdomain>.workers.dev
Admin username: attendee
Expires: <actual event-account expiry>

Next: pnpm deploy
Save the private claim link shown above. Do not claim until after the workshop.
```

## 1.8 Make pnpm deploy use the cached temporary account

1. Keep pnpm deploy as the attendee-facing command. Integrate --temporary in the workshop deployment wrapper rather than requiring attendees to supply it.
2. Before building or deploying, read and validate the temporary cache through the shared helper. Require an unexpired account and claim window, and require cached account.id to equal deployment.jsonc accountId. If not, stop and direct the attendee to bootstrap/recovery. Do not silently provision a replacement.
3. Remove conflicting authentication environment variables from neither the user’s normal environment nor their credential store automatically. Detect conflicts and stop with a safe fix.
4. Pass --temporary to each of the six Wrangler deploy calls. Do not pass --event-code again. Preserve the starter’s deployment order: private dependencies and Workshop before the public router.
5. Generate account_id from deployment.jsonc for every Worker. Ensure the pinned Wrangler actually deploys all Workers into that same cached account.
6. Keep pnpm check a non-provisioning validation/build path. Do not trigger temporary provisioning as a side effect of check.
7. After deploying, print the configured publicBaseUrl and tell the attendee to register with the configured username, not their bootstrap email address.

For a workshop-only wrapper, the per-Worker Wrangler arguments should include the following, with exactly one --temporary flag:

```js
["deploy", "--config", generatedName, "--temporary", ...extraArgs]
```

Make failure handling explicit. A successful bootstrap followed by an expired cache must fail before deployment; it must not quietly start a new account. A partial Cloudflare OS deployment can be retried with pnpm deploy while the same account remains valid.

## 1.9 Confirm the event account’s service entitlements

Before rehearsal, obtain a test event code from the event-account owner. Confirm the actual temporary account supports Workers, Durable Objects, KV, R2, Browser Rendering, Dynamic Worker Loaders, Workers AI, and AI Gateway for the workshop’s required operations. R2/Containers entitlements alone do not establish that Cloudflare OS can run all its features.

Use the event account’s actual expiry. Do not copy the standard temporary-account 60-minute limit into the workshop guide. Confirm what changes when the attendee claims the account and how required services must be enabled afterward.

## 1.10 Test the exact attendee experience

1. From a fresh checkout, follow Section 2 without manual configuration edits. Test on macOS, Windows, and the Linux environments you will support.
2. Verify the Terms/Privacy prompt is visible and declining it stops setup. Verify errors never expose a temporary API token.
3. Confirm bootstrap updates the account ID, correct router origin, and email automatically. Confirm pnpm deploy reuses the same temporary account for all six Workers.
4. Create a password account using the collected username; verify /admin; close new signups; test login after sign-out.
5. Test AI chat, a persisted Gadget after refresh, Context, Scheduler, and browser export if included in the workshop.
6. Test rerunning bootstrap, retrying a partial deploy, conflicting OAuth/API-token credentials, a pre-existing unrelated temporary cache, mismatched account IDs, and expired credentials.
7. Update and run script tests, type checks, pnpm check with generated valid configuration, and the repository’s lint/test suite.

Have at least three people follow only the written guide. Fix every step that requires verbal help.

## 1.11 Publish the tested workshop revision

Add attendee commands to the workshop README. Document the supported tool versions, bootstrap output, private claim-link handling, and post-session claiming. Replace YOUR-ORG in Section 2 with the actual repository owner. Merge the tested workshop branch and publish a workshop-v1 tag.

```bash
git add .
git diff --cached
# Check that no attendee config, event code, token, claim URL, or password is staged.
git commit -m "Prepare temporary-account Cloudflare OS workshop"
git push -u origin workshop-setup
# Review and merge into the workshop repository’s default branch.
# From the merged, tested commit:
git tag workshop-v1
git push origin workshop-v1
```

Share the repository URL, tested tag, attendee guide, and live event code. Keep a completed example available for recovery; do not use that shared example as a substitute for each attendee’s own deployment.

Preparation references: 

* [starter README](https://github.com/cloudflare/cloudflare-os-starter)
* [password-mode changes](docs/customization.md#sign-in-methods)
* [temporary-account lifecycle and subdomain lookup](https://developers.cloudflare.com/workers/platform/claim-deployments/)
* [event-code/cache behavior](https://github.com/cloudflare/workers-sdk/blob/main/packages/workers-auth/src/temporary.ts)
