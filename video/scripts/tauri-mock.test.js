import { test } from "node:test";
import assert from "node:assert/strict";

await import("./tauri-mock.browser.js");
const { resolveInvoke } = globalThis.__TOOLY_MOCK__ ?? {};

test("resolveInvoke returns installed PS5 apps for scan_ps5_apps", () => {
  const apps = resolveInvoke("scan_ps5_apps", { ip: "192.168.1.50" });
  assert.ok(Array.isArray(apps));
  assert.ok(apps.length >= 3);
  assert.ok(apps.some((a) => a.title_id === "ETAH00001"));
  for (const app of apps) {
    assert.equal(typeof app.title_id, "string");
    assert.equal(typeof app.app_ver, "string");
  }
});

test("resolveInvoke answers batch update check for every requested repo", () => {
  const repos = ["lightningmods/etahen", "bucanero/apollo-ps5"];
  const result = resolveInvoke("check_batch_github_updates", { repos });
  assert.equal(result.length, repos.length);
  for (const [repo, release] of result) {
    assert.ok(repos.includes(repo), `unexpected repo ${repo}`);
    assert.equal(typeof release.tag_name, "string");
    assert.ok(release.assets.length > 0);
    assert.ok(
      release.assets.some((a) => /\.(pkg|bin|elf|zip)$/i.test(a.name)),
      `no installable asset for ${repo}`
    );
  }
});

test("resolveInvoke rejects unknown command", () => {
  assert.throws(() => resolveInvoke("definitely_not_a_command", {}), /unknown/i);
});
