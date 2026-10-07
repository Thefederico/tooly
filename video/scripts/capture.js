import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SHOTS_DIR = path.resolve(__dirname, "..", "public", "shots");
const MOCK_PATH = path.resolve(__dirname, "tauri-mock.browser.js");
const DEV_URL = "http://localhost:1420";

async function isServerUp() {
  try {
    const res = await fetch(DEV_URL, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerUp()) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  mkdirSync(SHOTS_DIR, { recursive: true });

  let server = null;
  let browser = null;

  try {
    if (!(await isServerUp())) {
      console.log("Starting Vite dev server...");
      server = spawn("pnpm", ["dev"], { cwd: REPO_ROOT, stdio: "ignore" });
      if (!(await waitForServer())) {
        throw new Error("Vite dev server did not come up on :1420");
      }
    }

    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });

    await context.addInitScript(() => {
      localStorage.setItem("tooly_language", "en");
    });
    await context.addInitScript({ path: MOCK_PATH });

    const page = await context.newPage();
    await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });

    // Shot 1: connection card / radar moment (before auto-discovery resolves)
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(SHOTS_DIR, "01-connect.png") });

    // Shot 2: populated dashboard with update badges
    await page.locator("h4", { hasText: "etaHEN" }).waitFor({ timeout: 15000 });
    await page.locator("span", { hasText: "Update" }).first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(SHOTS_DIR, "02-dashboard.png") });

    // Shot 3: install in progress (trigger_dpi_update held open by mock for 3s)
    const updateButtons = page.locator("button", { hasText: "Update" });
    await updateButtons.first().click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(SHOTS_DIR, "03-installing.png") });

    console.log("Shots written to", SHOTS_DIR);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (server) {
      server.kill("SIGTERM");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
