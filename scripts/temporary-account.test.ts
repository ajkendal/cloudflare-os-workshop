import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import {
  assertNoConflictingCredentials,
  assertTemporaryAccountForDeployment,
  temporaryAccountPath,
} from "./temporary-account.ts";

const accountId = "0123456789abcdef0123456789abcdef";
const savedEnv = { ...process.env };
let home: string;

// An isolated home and XDG directory, so neither the developer's real Wrangler login nor a real
// temporary-account cache can leak into (or be touched by) these tests.
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "workshop-temporary-account-"));
  Object.assign(process.env, { HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: join(home, "xdg") });
  for (const name of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_KEY", "CLOUDFLARE_GLOBAL_API_KEY"]) {
    delete process.env[name];
  }
});

afterEach(async () => {
  process.env = { ...savedEnv };
  await rm(home, { recursive: true, force: true });
});

async function writeCache(overrides: { id?: string; accountExpiresAt?: string; claimExpiresAt?: string } = {}) {
  const future = new Date(Date.now() + 3_600_000).toISOString();
  const path = temporaryAccountPath();
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, [
    "[account]",
    `id = "${overrides.id ?? accountId}"`,
    `name = "workshop"`,
    `apiToken = "test-token"`,
    `expiresAt = "${overrides.accountExpiresAt ?? future}"`,
    "[claim]",
    `url = "https://example.invalid/claim"`,
    `expiresAt = "${overrides.claimExpiresAt ?? future}"`,
  ].join("\n"));
}

test("accepts an unexpired cache for the configured account", async () => {
  await writeCache();
  const account = await assertTemporaryAccountForDeployment(accountId.toUpperCase());
  assert.equal(account.accountId, accountId);
});

test("refuses to deploy without a cache rather than provisioning one", async () => {
  await assert.rejects(assertTemporaryAccountForDeployment(accountId), /node bootstrap\.js/);
});

test("refuses an expired account or claim window", async () => {
  const past = new Date(Date.now() - 1000).toISOString();
  await writeCache({ accountExpiresAt: past });
  await assert.rejects(assertTemporaryAccountForDeployment(accountId), /No valid temporary-account cache/);
  await writeCache({ claimExpiresAt: past });
  await assert.rejects(assertTemporaryAccountForDeployment(accountId), /No valid temporary-account cache/);
});

test("refuses a cache for a different account", async () => {
  await writeCache({ id: "fedcba9876543210fedcba9876543210" });
  await assert.rejects(assertTemporaryAccountForDeployment(accountId), /does not match deployment\.jsonc/);
});

test("stops on conflicting credentials without removing them", async () => {
  assertNoConflictingCredentials();
  process.env.CLOUDFLARE_API_TOKEN = "unrelated";
  assert.throws(assertNoConflictingCredentials, /CLOUDFLARE_API_TOKEN/);
  assert.equal(process.env.CLOUDFLARE_API_TOKEN, "unrelated");
});
