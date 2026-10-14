import { createInterface } from "node:readline/promises";
import { existsSync } from "node:fs";
import { access, rename, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { applyEdits, modify, parse, printParseErrorCode } from "jsonc-parser";
import { pnpmCommand } from "./cloudflare-os/scripts/pnpm-command.ts";
import { resolveBinEntry } from "./cloudflare-os/scripts/bin-entry.ts";
import {
  assertNoConflictingCredentials,
  conflictingCredentialSources,
  readTemporaryAccount,
} from "./scripts/temporary-account.ts";

const root = dirname(fileURLToPath(import.meta.url));
const minimumNode = [24, 19, 0];
const pinnedWrangler = "4.144.0";
const emailPattern = /^[^@\s]+@[^@\s]+$/;
const usernamePattern = /^[a-z][a-z0-9_]*$/;
const accountIdPattern = /^[a-f\d]{32}$/i;

// A Cloudflare OS username is not an email address. The Workshop backend normalizes every account
// name to `usernamePattern` (`normalizeUsername` in
// cloudflare-os/packages/workshop-backend/src/user.ts), and `/admin` is granted by exact match of
// that normalized name against ADMINS -- so writing an email into `access.admins` would lock the
// attendee out of their own deployment. Derive the name they will actually register instead.
// Derivation beats a second prompt here because rerunning bootstrap has to reproduce the value
// already deployed in ADMINS, and a re-entered answer need not match.
function usernameFromEmail(email) {
  const local = email.slice(0, email.indexOf("@")).toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const username = /^[a-z]/.test(local) ? local : `user_${local}`;
  if (!usernamePattern.test(username)) throw new Error(`Could not derive a Cloudflare OS username from "${email}". Rerun bootstrap with a different address, or ask the workshop organizer for help.`);
  return username;
}

function versionAtLeast(actual, minimum) {
  const values = actual.replace(/^v/, "").split(".").map(Number);
  for (let index = 0; index < minimum.length; index++) {
    if (values[index] > minimum[index]) return true;
    if (values[index] < minimum[index]) return false;
  }
  return true;
}

function run(command, args, label) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed. Its output is above.`);
}

function output(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", env: process.env });
  if (result.error || result.status !== 0) return undefined;
  return result.stdout.trim();
}

async function prerequisites() {
  if (!versionAtLeast(process.version, minimumNode)) throw new Error("Node.js 24.19 or newer is required. Install it, then rerun `node bootstrap.js`.");
  const pnpmVersion = output(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["--version"]);
  if (!pnpmVersion || !versionAtLeast(pnpmVersion, [11, 17, 0])) throw new Error("pnpm 11.17 or newer is required. Enable it with `corepack prepare pnpm@11.17.0 --activate`, then rerun bootstrap.");
  if (!existsSync(join(root, "cloudflare-os/package.json"))) throw new Error("Vendored Cloudflare OS files are missing. Re-clone this workshop repository, then rerun bootstrap.");
  for (const path of ["node_modules/wrangler/package.json", "cloudflare-os/node_modules/wrangler/package.json"]) {
    try { await access(join(root, path)); } catch { throw new Error("Dependencies are not installed. Run `pnpm install` and `pnpm --dir cloudflare-os install`, then rerun bootstrap."); }
  }
  const version = output(process.execPath, [resolve(root, "node_modules/wrangler/bin/wrangler.js"), "--version"]);
  if (version !== pinnedWrangler) throw new Error(`Pinned Wrangler ${pinnedWrangler} is required (found ${version ?? "none"}). Run \`pnpm install\`, then rerun bootstrap.`);
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question(question)).trim(); } finally { rl.close(); }
}

async function getSubdomain(account) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account.accountId}/workers/subdomain`, { headers: { Authorization: `Bearer ${account.apiToken}` } });
  if (!response.ok) throw new Error(`Could not retrieve the workers.dev subdomain (${response.status}). Run bootstrap again or ask the workshop organizer for help.`);
  const body = await response.json();
  const subdomain = body?.result?.subdomain;
  if (body?.success !== true || typeof subdomain !== "string" || !/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(subdomain)) throw new Error("Cloudflare returned an invalid workers.dev subdomain. Stop and ask the workshop organizer for help.");
  return subdomain.toLowerCase();
}

async function writeConfiguration(account, username) {
  const subdomain = await getSubdomain(account);
  const templatePath = join(root, "deployment.template.jsonc");
  const text = await (await import("node:fs/promises")).readFile(templatePath, "utf8");
  const errors = [];
  parse(text, errors, { allowTrailingComma: true });
  if (errors.length) throw new Error(`deployment.template.jsonc: ${printParseErrorCode(errors[0].error)} at offset ${errors[0].offset}`);
  let next = text;
  for (const [path, value] of [
    [["accountId"], account.accountId],
    [["workers", "router", "route"], { workersDev: true }],
    [["publicBaseUrl"], `https://connect-os.${subdomain}.workers.dev`],
    [["access", "admins"], [username]],
  ]) next = applyEdits(next, modify(next, path, value, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
  const destination = join(root, "deployment.jsonc");
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, next);
  await rename(temporary, destination);
  return `https://connect-os.${subdomain}.workers.dev`;
}

async function main() {
  await prerequisites();
  const cached = await readTemporaryAccount();
  const configPath = join(root, "deployment.jsonc");
  if (cached && existsSync(configPath)) {
    const existing = parse(await (await import("node:fs/promises")).readFile(configPath, "utf8"));
    if (existing?.accountId !== cached.accountId) throw new Error("deployment.jsonc and the cached temporary account differ. Do not overwrite either one. Ask the workshop organizer for explicit recovery.");
    const configured = String(existing?.access?.admins?.[0] ?? "").toLowerCase();
    // Accept an email here only to repair a deployment.jsonc written by an earlier bootstrap, which
    // stored the address itself. Rewriting it to the derived username is what makes /admin reachable.
    const username = emailPattern.test(configured) ? usernameFromEmail(configured) : configured;
    if (!usernamePattern.test(username)) throw new Error("The existing deployment.jsonc has no valid administrator username. Ask the workshop organizer for recovery.");
    assertNoConflictingCredentials();
    const siteUrl = await writeConfiguration(cached, username);
    console.log("\nWorkshop configuration ready.");
    console.log(`Account ID: ${cached.accountId}\nSite URL: ${siteUrl}\nAdmin username: ${username}\nExpires: ${cached.accountExpiresAt}`);
    console.log("\nNext: pnpm deploy\nSave the private claim link shown above. Do not claim until after the workshop.");
    console.log(`\nPrivate claim link — do not share or claim until after the session:\n${cached.claimUrl}`);
    return;
  }
  const conflicts = conflictingCredentialSources();
  if (conflicts.length || cached) {
    throw new Error(cached ? "A temporary account is already cached. Do not overwrite it. If it is your workshop account, restore its matching deployment.jsonc and rerun bootstrap; otherwise use a separate OS user/profile." : `Temporary accounts require no other Wrangler credentials. Found: ${conflicts.join(", ")}. Do not delete them automatically; use a separate OS user/profile or run \`wrangler logout\` only after confirming they are safe to remove.`);
  }
  const eventCode = await prompt("Session event code: ");
  if (!eventCode) throw new Error("Event code cannot be empty. Rerun bootstrap and enter the code from the speaker.");
  const email = (await prompt("Email address (identifies you to the workshop organizer): ")).toLowerCase();
  if (!emailPattern.test(email)) throw new Error("Enter a valid email address. Rerun bootstrap to try again.");
  const username = usernameFromEmail(email);
  console.log(`\nYour Cloudflare OS username will be: ${username}\nCloudflare OS usernames are not email addresses. Register with this exact name.`);
  const entry = resolveBinEntry(root, "wrangler");
  if (!entry) throw new Error("Pinned Wrangler could not be resolved. Run `pnpm install`, then rerun bootstrap.");
  run(process.execPath, [entry, "deploy", "--config", "bootstrap/wrangler.jsonc", "--temporary", "--event-code", eventCode], "Bootstrap deployment");
  const account = await readTemporaryAccount();
  if (!account || !accountIdPattern.test(account.accountId)) throw new Error("Wrangler completed but did not create a valid temporary account cache. Do not retry blindly; ask the workshop organizer for help.");
  const siteUrl = await writeConfiguration(account, username);
  console.log("\nWorkshop configuration ready.");
  console.log(`Account ID: ${account.accountId}\nSite URL: ${siteUrl}\nAdmin username: ${username}\nExpires: ${account.accountExpiresAt}`);
  console.log("\nNext: pnpm deploy\nSave the private claim link shown above. Do not claim until after the workshop.");
  console.log(`\nPrivate claim link — do not share or claim until after the session:\n${account.claimUrl}`);
}

main().catch((error) => { console.error(`\nBootstrap failed. ${error.message}`); process.exitCode = 1; });
