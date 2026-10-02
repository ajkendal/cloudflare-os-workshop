import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import * as TOML from "@iarna/toml";

const accountIdPattern = /^[a-f\d]{32}$/i;

type TemporaryAccountCache = {
  account?: { id?: string; name?: string; apiToken?: string; expiresAt?: string };
  claim?: { url?: string; expiresAt?: string };
};

export type TemporaryAccount = {
  accountId: string;
  accountName: string;
  apiToken: string;
  accountExpiresAt: string;
  claimUrl: string;
  claimExpiresAt: string;
};

function xdgConfigHome(): string {
  if (process.env.XDG_CONFIG_HOME) return process.env.XDG_CONFIG_HOME;
  if (platform() === "darwin") return join(homedir(), "Library", "Preferences");
  if (platform() === "win32") return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "xdg.config");
  return join(homedir(), ".config");
}

/** Mirrors pinned Wrangler's legacy-home-first global config resolution. */
export function wranglerConfigDirectory(): string {
  const legacy = join(homedir(), ".wrangler");
  return existsSync(legacy) ? legacy : join(xdgConfigHome(), ".wrangler");
}

export function temporaryAccountPath(): string {
  return join(wranglerConfigDirectory(), "wrangler-temporary-account.toml");
}

function futureTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.now();
}

function temporaryAccountFromCache(cache: TemporaryAccountCache): TemporaryAccount | undefined {
  const account = cache.account;
  const claim = cache.claim;
  if (!account || !claim || !accountIdPattern.test(account.id ?? "") || !account.name ||
      !account.apiToken || !futureTimestamp(account.expiresAt) || !claim.url ||
      !futureTimestamp(claim.expiresAt)) return undefined;
  const { id, name, apiToken, expiresAt } = account;
  const { url, expiresAt: claimExpiresAt } = claim;
  return {
    accountId: id!.toLowerCase(), accountName: name!, apiToken: apiToken!,
    accountExpiresAt: expiresAt!, claimUrl: url!, claimExpiresAt: claimExpiresAt!,
  };
}

export async function readTemporaryAccount(): Promise<TemporaryAccount | undefined> {
  const path = temporaryAccountPath();
  if (!existsSync(path)) return undefined;
  const cache = TOML.parse(await readFile(path, "utf8")) as TemporaryAccountCache;
  return temporaryAccountFromCache(cache);
}

export function conflictingCredentialSources(): string[] {
  const names = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_KEY", "CLOUDFLARE_GLOBAL_API_KEY"];
  const present = names.filter((name) => Boolean(process.env[name]));
  const configDir = wranglerConfigDirectory();
  // Wrangler's normal OAuth/profile stores. Do not read their contents.
  for (const name of ["config/default.toml", "config/default.enc", "config.toml", "config.json"]) {
    if (existsSync(join(configDir, name))) present.push(`stored Wrangler credentials (${name})`);
  }
  return present;
}

export function assertNoConflictingCredentials(): void {
  const conflicts = conflictingCredentialSources();
  if (conflicts.length) {
    throw new Error(
      `Temporary-account deployment cannot run while other Wrangler credentials are present: ${conflicts.join(", ")}. ` +
      "Do not delete credentials automatically. Open a separate OS user/profile or run `wrangler logout` only after confirming those credentials are safe to remove.");
  }
}

export async function assertTemporaryAccountForDeployment(expectedAccountId: string): Promise<TemporaryAccount> {
  const account = await readTemporaryAccount();
  if (!account) throw new Error(
    "No valid temporary-account cache was found. Run `node bootstrap.js` to configure a workshop account; do not provision a replacement from `pnpm deploy`.");
  if (account.accountId !== expectedAccountId.toLowerCase()) throw new Error(
    "The cached temporary account does not match deployment.jsonc. Stop and run `node bootstrap.js` for explicit recovery; do not deploy into either account.");
  return account;
}
